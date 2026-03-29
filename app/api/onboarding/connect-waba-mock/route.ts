// MOCK — solo para desarrollo, mientras no hay cuenta Partner de 360dialog.
// Reemplazar por el flujo real de OAuth cuando esté disponible.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (orgError || !org) {
    return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 })
  }

  const { error } = await supabase
    .from('waba_connections')
    .insert({
      org_id: org.id,
      channel_id: `mock_channel_${Date.now()}`,
      api_key: `mock_api_key_${Date.now()}`,
      status: 'active',
    })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ya existe una conexión WABA para esta organización' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
