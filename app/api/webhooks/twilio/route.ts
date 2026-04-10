import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'crypto'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const OPT_OUT_KEYWORDS = ['stop', 'baja', 'no', 'cancelar', 'salir', 'nomasinfo']

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
  const incomingBody = bodyParams.get('Body')
  const fromNumber = bodyParams.get('From')
  const toNumber = bodyParams.get('To')

  // ── Detección de opt-out (mensaje entrante del usuario final) ──────────────
  if (incomingBody && fromNumber && toNumber && (!messageStatus || messageStatus === 'received')) {
    const normalizedText = incomingBody.toLowerCase().replace(/\s+/g, '')
    const isOptOut = OPT_OUT_KEYWORDS.some((kw) => normalizedText.includes(kw))

    if (isOptOut) {
      // fromNumber = "whatsapp:+5491155441234" → "5491155441234"
      const fromPhone = fromNumber.replace('whatsapp:+', '')
      // toNumber = "whatsapp:+13659063072" → "+13659063072"
      const toPhone = toNumber.replace('whatsapp:', '')

      const serviceClient = getServiceClient()

      // Buscar la org por el número destino (nuestro número en waba_connections)
      const { data: waba } = await serviceClient
        .from('waba_connections')
        .select('org_id')
        .eq('phone_number', toPhone)
        .eq('status', 'active')
        .single()

      if (waba) {
        await serviceClient
          .from('blacklist')
          .upsert(
            { org_id: waba.org_id, phone: fromPhone, origin: 'automatic' },
            { onConflict: 'org_id,phone' }
          )
      }

      const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Listo, te dimos de baja. No recibirás más mensajes de nuestra parte.</Message></Response>`
      return new Response(twiml, {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    // Mensaje entrante que no es opt-out — ignorar
    return NextResponse.json({ ok: true })
  }

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
