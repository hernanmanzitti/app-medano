import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Normaliza teléfono al mismo formato que message_logs.phone (sin +)
// Entrada: número local argentino o número ya formateado
// Salida: "5491155441234"
function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (digits.startsWith('549')) return digits
  if (digits.startsWith('54') && digits.length >= 12) return digits
  return `549${digits}`
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!org) {
    return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 })
  }

  const { data, error } = await getServiceClient()
    .from('blacklist')
    .select('id, phone, origin, created_at')
    .eq('org_id', org.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await request.json()
  const { phone, origin = 'manual' } = body

  if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
    return NextResponse.json({ error: 'Teléfono requerido' }, { status: 400 })
  }

  if (!['manual', 'automatic'].includes(origin)) {
    return NextResponse.json({ error: 'origin debe ser manual o automatic' }, { status: 400 })
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!org) {
    return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 })
  }

  const normalizedPhone = normalizePhone(phone.trim())

  const { data, error } = await getServiceClient()
    .from('blacklist')
    .insert({ org_id: org.id, phone: normalizedPhone, origin })
    .select('id, phone, origin, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Este número ya está en la lista de opt-out' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
