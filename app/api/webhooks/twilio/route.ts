import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createHmac, timingSafeEqual } from 'crypto'

function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): { valid: boolean; computed: string; sortedParams: Record<string, string> } {
  const sortedKeys = Object.keys(params).sort()
  const sortedParams = Object.fromEntries(sortedKeys.map((k) => [k, params[k]]))
  const dataToSign = url + sortedKeys.map((k) => k + params[k]).join('')
  const computed = createHmac('sha1', authToken).update(dataToSign).digest('base64')

  const expected = Buffer.from(computed)
  const received = Buffer.from(signature)
  const valid = expected.length === received.length && timingSafeEqual(expected, received)
  return { valid, computed, sortedParams }
}

export async function POST(request: Request) {
  const rawBody = await request.text()

  const isMock = process.env.NEXT_PUBLIC_WABA_MOCK === 'true'
  if (!isMock) {
    const signature = request.headers.get('X-Twilio-Signature') ?? ''
    const authToken = process.env.TWILIO_AUTH_TOKEN ?? ''
    const url = (process.env.NEXT_PUBLIC_APP_URL ?? '') + '/api/webhooks/twilio'

    const params: Record<string, string> = {}
    new URLSearchParams(rawBody).forEach((value, key) => {
      params[key] = value
    })

    const { valid, computed, sortedParams } = validateTwilioSignature(authToken, signature, url, params)
    if (!valid) {
      console.log('Webhook Twilio — firma inválida.', {
        url,
        sortedParams,
        computedSignature: computed,
        receivedSignature: signature,
      })
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }
  }

  const bodyParams = new URLSearchParams(rawBody)
  const messageSid = bodyParams.get('MessageSid') as string
  const messageStatus = bodyParams.get('MessageStatus') as string

  if (!messageSid || !messageStatus) {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  // Mapear status de Twilio a nuestro enum
  const statusMap: Record<string, string> = {
    sent: 'sent',
    delivered: 'delivered',
    read: 'read',
    failed: 'failed',
    undelivered: 'failed',
  }

  const mappedStatus = statusMap[messageStatus]
  if (!mappedStatus) {
    // Status que no nos interesa (queued, accepted, etc.) — ignorar
    return NextResponse.json({ ok: true })
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('message_logs')
    .update({ status: mappedStatus, wam_id: messageSid })
    .eq('wam_id', messageSid)

  if (error) {
    console.error('Webhook Twilio — error actualizando message_logs:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
