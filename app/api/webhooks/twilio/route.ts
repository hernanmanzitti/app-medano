import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'crypto'
import { parseRating } from '@/lib/rating'
import { sendFreeForm } from '@/lib/twilio'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const OPT_OUT_KEYWORDS = ['stop', 'baja', 'no', 'cancelar', 'salir', 'nomasinfo']

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildTwimlResponse(message: string): Response {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`
  return new Response(twiml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}

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

  const signature = request.headers.get('X-Twilio-Signature') ?? ''
  const url = (process.env.NEXT_PUBLIC_APP_URL ?? '') + '/api/webhooks/twilio'
  const params: Record<string, string> = {}
  new URLSearchParams(rawBody).forEach((value, key) => { params[key] = value })

  console.log('Webhook Twilio — request recibido', {
    isMock,
    url,
    hasSignature: !!signature,
    hasSubaccountToken: !!process.env.TWILIO_SUBACCOUNT_AUTH_TOKEN,
    hasMasterToken: !!process.env.TWILIO_AUTH_TOKEN,
    messageStatus: params['MessageStatus'] ?? null,
    messageSid: params['MessageSid'] ?? null,
    from: params['From'] ?? null,
    to: params['To'] ?? null,
  })

  if (!isMock) {
    const tokensToTry = [
      process.env.TWILIO_SUBACCOUNT_AUTH_TOKEN ?? '',
      process.env.TWILIO_AUTH_TOKEN ?? '',
    ].filter(Boolean)

    if (tokensToTry.length === 0) {
      console.error('Webhook Twilio — no hay tokens configurados para validar firma')
      return NextResponse.json({ error: 'Misconfigured' }, { status: 500 })
    }

    const signatureValid = tokensToTry.some((token) => {
      const { valid } = validateTwilioSignature(token, signature, url, params)
      return valid
    })

    if (!signatureValid) {
      const { computed, sortedParams } = validateTwilioSignature(tokensToTry[0], signature, url, params)
      console.error('Webhook Twilio — firma inválida con todos los tokens disponibles.', {
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

  // ── Mensaje entrante del usuario final ────────────────────────────────────
  if (incomingBody && fromNumber && toNumber && (!messageStatus || messageStatus === 'received')) {
    const fromPhone = fromNumber.replace('whatsapp:+', '')
    const toPhone = toNumber.replace('whatsapp:', '')

    console.log('Webhook — inbound message:', { fromPhone, toPhone, body: incomingBody })

    const serviceClient = getServiceClient()

    const { data: waba, error: wabaError } = await serviceClient
      .from('waba_connections')
      .select('org_id, twilio_subaccount_sid, phone_number')
      .eq('phone_number', toPhone)
      .eq('status', 'active')
      .single()

    if (!waba) {
      console.error('Webhook — waba no encontrada para toPhone:', toPhone, wabaError)
      return NextResponse.json({ ok: true })
    }

    const { data: org, error: orgError } = await serviceClient
      .from('organizations')
      .select('id, name, forwarding_number')
      .eq('id', waba.org_id)
      .single()

    if (!org) {
      console.error('Webhook — org no encontrada para org_id:', waba.org_id, orgError)
      return NextResponse.json({ ok: true })
    }

    // Buscar el último message_log del teléfono para este org (una sola query)
    const { data: lastLog } = await serviceClient
      .from('message_logs')
      .select('id, flow_step, satisfaction_score, customer_name, location_id, created_at')
      .eq('org_id', waba.org_id)
      .eq('phone', fromPhone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const ageMs = lastLog ? Date.now() - new Date(lastLog.created_at).getTime() : Infinity
    const within24h = ageMs < 24 * 60 * 60 * 1000

    // ── RAMA DE FLUJO CONVERSACIONAL (solo cuando el flag está activo) ────────
    if (process.env.FLOW_CONVERSATIONAL_ENABLED === 'true') {
      const activeFlowStep = lastLog?.flow_step as string | null | undefined
      const isInActiveFlow = within24h && (activeFlowStep === 'rating_asked' || activeFlowStep === 'feedback_received')

      // ─── Rama A: respuesta al rating ────────────────────────────────────────
      if (activeFlowStep === 'rating_asked' && within24h) {
        const score = parseRating(incomingBody)

        if (score === null) {
          console.log('[rating-flow] respuesta no parseable, flujo abierto:', incomingBody)
          return new Response('OK', { status: 200 })
        }

        // Resolver review_link: sucursal del log original o link de la org
        let reviewLink: string | null = null
        if (lastLog?.location_id) {
          const { data: loc } = await serviceClient
            .from('locations')
            .select('review_link')
            .eq('id', lastLog.location_id)
            .single()
          reviewLink = loc?.review_link ?? null
        }
        if (!reviewLink) {
          const { data: orgFull } = await serviceClient
            .from('organizations')
            .select('review_link')
            .eq('id', waba.org_id)
            .single()
          reviewLink = orgFull?.review_link ?? null
        }

        const customerName = lastLog?.customer_name ?? ''
        const fromWhatsapp = `whatsapp:${waba.phone_number}`
        const toWhatsapp = `whatsapp:+${fromPhone}`

        if (score >= 4) {
          console.log(`[rating-flow] score ${score} → positivo, enviando link`)
          const body =
            `¡Gracias ${customerName}! 🙌\n\n` +
            `Compartí tu experiencia en Google:\n${reviewLink ?? ''}`
          try {
            await sendFreeForm({ subaccountSid: waba.twilio_subaccount_sid, from: fromWhatsapp, to: toWhatsapp, body })
          } catch (err) {
            console.error('[rating-flow] error enviando link:', err)
          }
          await serviceClient
            .from('message_logs')
            .update({ flow_step: 'link_sent', satisfaction_score: score, status: 'reply_received' })
            .eq('id', lastLog!.id)
        } else {
          console.log(`[rating-flow] score ${score} → negativo, pidiendo detalle`)
          const body =
            `Gracias por tu sinceridad, ${customerName}.\n\n` +
            `Queremos entender qué pasó. ¿Nos contás brevemente qué no estuvo bien? ` +
            `Tu mensaje llega directo al equipo de ${org.name}.`
          try {
            await sendFreeForm({ subaccountSid: waba.twilio_subaccount_sid, from: fromWhatsapp, to: toWhatsapp, body })
          } catch (err) {
            console.error('[rating-flow] error enviando solicitud feedback:', err)
          }
          await serviceClient
            .from('message_logs')
            .update({ flow_step: 'feedback_received', satisfaction_score: score, status: 'reply_received' })
            .eq('id', lastLog!.id)
        }

        return new Response('OK', { status: 200 })
      }

      // ─── Rama B: detalle del feedback negativo ───────────────────────────────
      if (activeFlowStep === 'feedback_received' && within24h) {
        console.log('[rating-flow] detalle de feedback negativo recibido')
        const score = lastLog?.satisfaction_score ?? null
        const customerName = lastLog?.customer_name ?? ''
        const fromWhatsapp = `whatsapp:${waba.phone_number}`
        const toWhatsapp = `whatsapp:+${fromPhone}`

        if (org.forwarding_number) {
          const fwdBody =
            `Feedback negativo (⭐ ${score}/5) de +${fromPhone} para ${org.name}:\n"${incomingBody}"`
          try {
            await sendFreeForm({
              subaccountSid: waba.twilio_subaccount_sid,
              from: fromWhatsapp,
              to: `whatsapp:${org.forwarding_number}`,
              body: fwdBody,
            })
            console.log('[rating-flow] feedback reenviado a forwarding_number')
          } catch (err) {
            console.error('[rating-flow] error reenviando feedback:', err)
          }
        }

        try {
          await sendFreeForm({
            subaccountSid: waba.twilio_subaccount_sid,
            from: fromWhatsapp,
            to: toWhatsapp,
            body: `Gracias por contarnos, ${customerName}. Tu mensaje llegó al equipo.`,
          })
        } catch (err) {
          console.error('[rating-flow] error enviando ack al usuario:', err)
        }

        await serviceClient
          .from('message_logs')
          .update({ flow_step: 'completed', status: 'reply_received' })
          .eq('id', lastLog!.id)

        return new Response('OK', { status: 200 })
      }

      // ─── Protección: suspender opt-out automático durante flujo activo ───────
      // Si isInActiveFlow=true, saltear detección de keywords para evitar que
      // "no fue buena la atención" bloquee al usuario por error.
      if (isInActiveFlow) {
        console.log('[rating-flow] flujo activo — saltando detección de opt-out')
        // Cae al forwarding genérico abajo (sin opt-out check)
      } else {
        // ── Detección de opt-out (solo si NO hay flujo activo) ──────────────
        const normalizedText = incomingBody.toLowerCase().replace(/\s+/g, '')
        const isOptOut = OPT_OUT_KEYWORDS.some((kw) => normalizedText.includes(kw))

        if (isOptOut) {
          await serviceClient
            .from('blacklist')
            .upsert(
              { org_id: waba.org_id, phone: fromPhone, origin: 'automatic' },
              { onConflict: 'org_id,phone' }
            )
          return buildTwimlResponse('Listo, te dimos de baja. No recibirás más mensajes de nuestra parte.')
        }
      }
    } else {
      // ── Flag apagado: comportamiento legacy completo ────────────────────────
      const normalizedText = incomingBody.toLowerCase().replace(/\s+/g, '')
      const isOptOut = OPT_OUT_KEYWORDS.some((kw) => normalizedText.includes(kw))

      if (isOptOut) {
        await serviceClient
          .from('blacklist')
          .upsert(
            { org_id: waba.org_id, phone: fromPhone, origin: 'automatic' },
            { onConflict: 'org_id,phone' }
          )
        return buildTwimlResponse('Listo, te dimos de baja. No recibirás más mensajes de nuestra parte.')
      }
    }

    // ── Forwarding genérico (Fase 9) — se ejecuta si no hubo return temprano ──
    if (lastLog) {
      await serviceClient
        .from('message_logs')
        .update({ status: 'reply_received' })
        .eq('id', lastLog.id)
    }

    if (org.forwarding_number) {
      const forwardMessage = `Mensaje de +${fromPhone} para ${org.name}: ${incomingBody}`
      console.log('Webhook — reenviando a:', org.forwarding_number, '| mensaje:', forwardMessage)

      try {
        await sendFreeForm({
          subaccountSid: waba.twilio_subaccount_sid,
          from: `whatsapp:${waba.phone_number}`,
          to: `whatsapp:${org.forwarding_number}`,
          body: forwardMessage,
        })
        console.log('Webhook — reenvío OK')
      } catch (err) {
        console.error('Webhook — error reenviando respuesta:', err)
      }

      const waNumber = org.forwarding_number.replace(/\D/g, '')
      const autoReply =
        `Gracias por tu mensaje.\n\nEste número solo se utiliza para enviar solicitudes de reseñas. ` +
        `Si querés hacernos una consulta, comentario o necesitás atención al cliente, escribinos al: ` +
        `wa.me/${waNumber}`
      return buildTwimlResponse(autoReply)
    }

    console.log('Webhook — sin forwarding_number, respondiendo con TwiML a:', fromPhone)
    return buildTwimlResponse(
      'Gracias por tu mensaje.\n\nEste número solo se utiliza para enviar solicitudes de reseñas.'
    )
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
