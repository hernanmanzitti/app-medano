import { NextResponse } from 'next/server'
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
    const url = (process.env.NEXT_PUBLIC_APP_URL ?? '') + '/api/webhooks/twilio'

    const params: Record<string, string> = {}
    new URLSearchParams(rawBody).forEach((value, key) => {
      params[key] = value
    })

    const tokensToTry = [
      process.env.TWILIO_AUTH_TOKEN ?? '',
      process.env.TWILIO_SUBACCOUNT_AUTH_TOKEN ?? '',
    ].filter(Boolean)

    const signatureValid = tokensToTry.some((token) => {
      const { valid } = validateTwilioSignature(token, signature, url, params)
      return valid
    })

    if (!signatureValid) {
      const { computed, sortedParams } = validateTwilioSignature(tokensToTry[0], signature, url, params)
      console.log('Webhook Twilio — firma inválida con todos los tokens disponibles.', {
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

    // Mensaje entrante — reply forwarding
    const fromPhone = fromNumber.replace('whatsapp:+', '')
    const toPhone = toNumber.replace('whatsapp:', '')

    const serviceClient = getServiceClient()

    const { data: waba } = await serviceClient
      .from('waba_connections')
      .select('org_id, twilio_subaccount_sid, phone_number')
      .eq('phone_number', toPhone)
      .eq('status', 'active')
      .single()

    if (!waba) {
      return NextResponse.json({ ok: true })
    }

    const { data: org } = await serviceClient
      .from('organizations')
      .select('id, name, forwarding_number')
      .eq('id', waba.org_id)
      .single()

    // Marcar el message_log más reciente de ese número como reply_received
    const { data: recentLog } = await serviceClient
      .from('message_logs')
      .select('id')
      .eq('org_id', waba.org_id)
      .eq('phone', fromPhone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (recentLog) {
      await serviceClient
        .from('message_logs')
        .update({ status: 'reply_received' })
        .eq('id', recentLog.id)
    }

    if (org?.forwarding_number) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID!
      const authToken = process.env.TWILIO_AUTH_TOKEN!
      const forwardMessage = `📩 Respuesta de +${fromPhone} a tu solicitud de reseña:\n\n${incomingBody}\n\n— ${org.name}`

      const forwardParams = new URLSearchParams({
        To: `whatsapp:${org.forwarding_number}`,
        From: `whatsapp:${waba.phone_number}`,
        Body: forwardMessage,
      })

      try {
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${waba.twilio_subaccount_sid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: 'Basic ' + btoa(`${accountSid}:${authToken}`),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: forwardParams.toString(),
          }
        )
        if (!res.ok) {
          const detail = await res.text()
          console.error('Webhook — error reenviando respuesta:', detail)
        }
      } catch (err) {
        console.error('Webhook — excepción al reenviar:', err)
      }

      return NextResponse.json({ ok: true })
    }

    // Sin forwarding_number — responder al usuario final con TwiML
    const orgName = org?.name ?? 'nosotros'
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Gracias por tu mensaje. Para consultas, escribinos directamente a ${orgName}.</Message></Response>`
    return new Response(twiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    })
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

  const { error } = await getServiceClient()
    .from('message_logs')
    .update({ status: mappedStatus, wam_id: messageSid })
    .eq('wam_id', messageSid)

  if (error) {
    console.error('Webhook Twilio — error actualizando message_logs:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
