import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getServiceClient() {
  const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    throw new Error(
      'Falta la service key de Supabase: definí SUPABASE_SECRET_KEY (o el nombre viejo SUPABASE_SERVICE_ROLE_KEY)'
    )
  }
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
}

// Tope defensivo — el frontend nunca manda más de 50 (MAX_PASTE_ROWS), esto
// es solo para no confiar ciegamente en el body de un POST.
const MAX_PHONES_PER_REQUEST = 200
const HISTORY_WINDOW_DAYS = 90
const VOLUME_WINDOW_HOURS = 24

interface HistoryMatch {
  lastContactAt: string
  status: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await request.json()
  const { phones } = body

  if (!Array.isArray(phones) || phones.length === 0) {
    return NextResponse.json({ error: 'phones debe ser un array no vacío' }, { status: 400 })
  }

  if (phones.length > MAX_PHONES_PER_REQUEST) {
    return NextResponse.json({ error: `phones supera el máximo de ${MAX_PHONES_PER_REQUEST}` }, { status: 400 })
  }

  // Comparación siempre por dígitos puros — nunca contra el string crudo
  // (ver PASO 0: message_logs.phone se guarda como "549"+10 dígitos, sin +
  // ni "whatsapp:", pero acá igual normalizamos por si el caller manda algo
  // con puntuación).
  const normalizedPhones = [...new Set(
    (phones as unknown[])
      .filter((p): p is string => typeof p === 'string')
      .map((p) => p.replace(/\D/g, ''))
      .filter((p) => p.length > 0)
  )]

  if (normalizedPhones.length === 0) {
    return NextResponse.json({ error: 'phones no contiene números válidos' }, { status: 400 })
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!org) {
    return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 })
  }

  const service = getServiceClient()

  const historyWindowStart = new Date(Date.now() - HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const volumeWindowStart = new Date(Date.now() - VOLUME_WINDOW_HOURS * 60 * 60 * 1000).toISOString()

  // Dedupe: últimos 90 días, excluyendo failed, filtrado explícito por
  // org_id además de por teléfono — sin esto, un cliente podría sondear si
  // un número fue contactado por otra org.
  const { data: historyRows, error: historyError } = await service
    .from('message_logs')
    .select('phone, status, created_at')
    .eq('org_id', org.id)
    .in('phone', normalizedPhones)
    .neq('status', 'failed')
    .gte('created_at', historyWindowStart)
    .order('created_at', { ascending: false })

  if (historyError) {
    console.error('check-history — error consultando message_logs:', historyError)
    return NextResponse.json({ error: 'Error consultando historial' }, { status: 500 })
  }

  // historyRows viene ordenado desc, así que la primera aparición de cada
  // teléfono ya es la más reciente.
  const history: Record<string, HistoryMatch> = {}
  for (const row of historyRows ?? []) {
    if (!history[row.phone]) {
      history[row.phone] = { lastContactAt: row.created_at, status: row.status }
    }
  }

  // Volumen de las últimas 24hs para el aviso de límite de Meta (250
  // conversaciones únicas/24hs) — cuenta mensajes que efectivamente
  // intentaron llegar a Twilio/Meta, no los bloqueados por opt-out ni los
  // fallidos.
  const { count: sentLast24h, error: volumeError } = await service
    .from('message_logs')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', org.id)
    .neq('status', 'failed')
    .neq('status', 'blocked')
    .gte('created_at', volumeWindowStart)

  if (volumeError) {
    console.error('check-history — error consultando volumen 24hs:', volumeError)
    return NextResponse.json({ error: 'Error consultando volumen de envíos' }, { status: 500 })
  }

  return NextResponse.json({ history, sentLast24h: sentLast24h ?? 0 })
}
