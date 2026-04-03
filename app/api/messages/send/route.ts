import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// Formatea número local argentino → E.164 sin el +
// Entrada: "1155441234" → Salida: "5491155441234"
function formatArgentinePhone(local: string): string {
  const digits = local.replace(/\D/g, '')
  return `549${digits}`
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { customer_name, phone, location_id } = await request.json()

  if (!customer_name || typeof customer_name !== 'string' || customer_name.trim().length === 0) {
    return NextResponse.json({ error: 'El nombre del cliente es requerido' }, { status: 400 })
  }

  if (!phone || typeof phone !== 'string' || !/^\d{8,10}$/.test(phone.trim())) {
    return NextResponse.json({ error: 'Teléfono inválido — ingresá solo el número local (ej: 1155441234)' }, { status: 400 })
  }

  // Obtener org + waba_connection del usuario
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, review_link')
    .eq('owner_id', user.id)
    .single()

  if (!org) {
    return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 })
  }

  // Resolver el review_link: sucursal seleccionada o link general de la org
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

  const fullPhone = formatArgentinePhone(phone.trim())
  const isMock = waba.api_key.startsWith('mock_')

  let messageStatus: 'sent' | 'failed' = 'sent'
  let errorDetail: string | null = null
  let wamId: string | null = null

  if (!isMock) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID!
    const authToken = process.env.TWILIO_AUTH_TOKEN!
    const templateSid = process.env.TWILIO_TEMPLATE_SID!

    // Obtener subaccount y número del cliente desde waba_connections
    const { data: wabaFull } = await supabase
      .from('waba_connections')
      .select('twilio_subaccount_sid, phone_number')
      .eq('org_id', org.id)
      .eq('status', 'active')
      .single()

    if (!wabaFull?.twilio_subaccount_sid || !wabaFull?.phone_number) {
      return NextResponse.json({ error: 'WABA no configurada correctamente' }, { status: 422 })
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${wabaFull.twilio_subaccount_sid}/Messages.json`

    const params = new URLSearchParams({
      To: `whatsapp:+${fullPhone}`,
      From: `whatsapp:${wabaFull.phone_number}`,
      ContentSid: templateSid,
      ContentVariables: JSON.stringify({
        '1': customer_name.trim(),
        '2': org.name,
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
      messageStatus = 'failed'
      errorDetail = detail
    } else {
      const twilioData = await res.json()
      wamId = twilioData.sid ?? null
    }
  }
  // Si isMock: se omite el envío real y se registra como 'sent'

  // Guardar en message_logs siempre
  await supabase.from('message_logs').insert({
    org_id: org.id,
    customer_name: customer_name.trim(),
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
