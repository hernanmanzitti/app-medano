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

  const { customer_name, phone } = await request.json()

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

  if (!org.review_link) {
    return NextResponse.json({ error: 'Configurá el link de reseña antes de enviar mensajes' }, { status: 422 })
  }

  const { data: waba } = await supabase
    .from('waba_connections')
    .select('api_key')
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

  if (!isMock) {
    // Llamada real a 360dialog
    const templateName = process.env.DIALOG360_TEMPLATE_NAME ?? 'review_request'
    const templateNamespace = process.env.DIALOG360_TEMPLATE_NAMESPACE ?? ''

    const body = {
      to: fullPhone,
      type: 'template',
      template: {
        namespace: templateNamespace,
        name: templateName,
        language: { code: 'es', policy: 'deterministic' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: customer_name.trim() },
              { type: 'text', text: org.name },
              { type: 'text', text: org.review_link },
            ],
          },
        ],
      },
    }

    const res = await fetch('https://waba.360dialog.io/v1/messages', {
      method: 'POST',
      headers: {
        'D360-API-KEY': waba.api_key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const detail = await res.text()
      console.error('360dialog send error:', detail)
      messageStatus = 'failed'
      errorDetail = detail
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
  })

  if (messageStatus === 'failed') {
    return NextResponse.json({ error: 'Error al enviar el mensaje por WhatsApp' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
