import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// Formatea número local argentino → E.164 sin el +
// Entrada: "1155441234" → Salida: "5491155441234"
function formatArgentinePhone(local: string): string {
  const digits = local.replace(/\D/g, '')
  return `549${digits}`
}

function validateContact(customer_name: unknown, phone: unknown): string | null {
  if (!customer_name || typeof customer_name !== 'string' || (customer_name as string).trim().length === 0) {
    return 'El nombre del cliente es requerido'
  }
  if (!phone || typeof phone !== 'string' || !/^\d{8,10}$/.test((phone as string).trim())) {
    return 'Teléfono inválido — ingresá solo el número local (ej: 1155441234)'
  }
  return null
}

async function dispatchToTwilio(
  orgName: string,
  reviewLink: string,
  customerName: string,
  fullPhone: string,
  wabaSubaccountSid: string,
  wabaPhoneNumber: string
): Promise<{ wamId: string | null; error: string | null }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!
  const authToken = process.env.TWILIO_AUTH_TOKEN!
  const templateSid = process.env.TWILIO_TEMPLATE_SID!

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${wabaSubaccountSid}/Messages.json`

  const params = new URLSearchParams({
    To: `whatsapp:+${fullPhone}`,
    From: `whatsapp:${wabaPhoneNumber}`,
    ContentSid: templateSid,
    ContentVariables: JSON.stringify({
      '1': customerName,
      '2': orgName,
      '3': reviewLink,
    }),
  })

  const res = await fetch(twilioUrl, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!res.ok) {
    const detail = await res.text()
    console.error('Twilio send error:', detail)
    return { wamId: null, error: detail }
  }

  const twilioData = await res.json()
  return { wamId: twilioData.sid ?? null, error: null }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await request.json()
  const { customer_name, phone, location_id, contacts } = body

  const isBatch = Array.isArray(contacts) && contacts.length > 0

  // Validación de entrada para modo individual
  if (!isBatch) {
    const validationError = validateContact(customer_name, phone)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }
  }

  // Obtener org del usuario
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, review_link')
    .eq('owner_id', user.id)
    .single()

  if (!org) {
    return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 })
  }

  // Resolver review_link: sucursal seleccionada o link general de la org
  let reviewLink = org.review_link

  if (location_id && typeof location_id === 'string') {
    const { data: location } = await supabase
      .from('locations')
      .select('review_link')
      .eq('id', location_id)
      .eq('org_id', org.id)
      .single()

    if (!location) {
      return NextResponse.json({ error: 'Sucursal no encontrada' }, { status: 404 })
    }
    reviewLink = location.review_link
  }

  if (!reviewLink) {
    return NextResponse.json({ error: 'Configurá el link de reseña antes de enviar mensajes' }, { status: 422 })
  }

  const { data: waba } = await supabase
    .from('waba_connections')
    .select('api_key, twilio_subaccount_sid, phone_number')
    .eq('org_id', org.id)
    .eq('status', 'active')
    .single()

  if (!waba) {
    return NextResponse.json({ error: 'No hay una WABA activa conectada' }, { status: 422 })
  }

  const isMock = waba.api_key.startsWith('mock_')

  if (!isMock && (!waba.twilio_subaccount_sid || !waba.phone_number)) {
    return NextResponse.json({ error: 'WABA no configurada correctamente' }, { status: 422 })
  }

  // ── Modo individual (comportamiento original) ──────────────────────────────
  if (!isBatch) {
    const fullPhone = formatArgentinePhone((phone as string).trim())

    let messageStatus: 'sent' | 'failed' = 'sent'
    let errorDetail: string | null = null
    let wamId: string | null = null

    if (!isMock) {
      const result = await dispatchToTwilio(
        org.name,
        reviewLink,
        (customer_name as string).trim(),
        fullPhone,
        waba.twilio_subaccount_sid,
        waba.phone_number
      )
      if (result.error) {
        messageStatus = 'failed'
        errorDetail = result.error
      } else {
        wamId = result.wamId
      }
    }

    await supabase.from('message_logs').insert({
      org_id: org.id,
      customer_name: (customer_name as string).trim(),
      phone: fullPhone,
      status: messageStatus,
      error: errorDetail,
      wam_id: wamId,
      location_id: location_id ?? null,
    })

    if (messageStatus === 'failed') {
      return NextResponse.json({ error: 'Error al enviar el mensaje por WhatsApp' }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  }

  // ── Modo batch ─────────────────────────────────────────────────────────────
  let sentCount = 0
  let failedCount = 0
  const results: { customer_name: string; phone: string; status: string; error?: string }[] = []

  for (const contact of contacts) {
    const { customer_name: cName, phone: cPhone } = contact

    const validationError = validateContact(cName, cPhone)
    if (validationError) {
      failedCount++
      results.push({ customer_name: cName ?? '', phone: cPhone ?? '', status: 'failed', error: validationError })
      continue
    }

    const fullPhone = formatArgentinePhone((cPhone as string).trim())
    let messageStatus: 'sent' | 'failed' = 'sent'
    let errorDetail: string | null = null
    let wamId: string | null = null

    if (!isMock) {
      const result = await dispatchToTwilio(
        org.name,
        reviewLink,
        (cName as string).trim(),
        fullPhone,
        waba.twilio_subaccount_sid,
        waba.phone_number
      )
      if (result.error) {
        messageStatus = 'failed'
        errorDetail = result.error
      } else {
        wamId = result.wamId
      }
    }

    const insertPayload = {
      org_id: org.id,
      customer_name: (cName as string).trim(),
      phone: fullPhone,
      status: messageStatus,
      error: errorDetail,
      wam_id: wamId,
      location_id: location_id ?? null,
    }
    console.log('Batch insert — payload:', insertPayload)
    const { error: insertError } = await supabase.from('message_logs').insert(insertPayload)
    if (insertError) {
      console.error('Batch insert — error en message_logs:', insertError)
    } else {
      console.log('Batch insert — OK para', (cName as string).trim(), fullPhone)
    }

    if (messageStatus === 'sent') {
      sentCount++
      results.push({ customer_name: (cName as string).trim(), phone: fullPhone, status: 'sent' })
    } else {
      failedCount++
      results.push({ customer_name: (cName as string).trim(), phone: fullPhone, status: 'failed', error: errorDetail ?? undefined })
    }
  }

  return NextResponse.json({ sent: sentCount, failed: failedCount, results })
}
