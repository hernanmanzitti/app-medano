import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { client_id } = await request.json()

  if (!client_id || typeof client_id !== 'string') {
    return NextResponse.json({ error: 'client_id requerido' }, { status: 400 })
  }

  // Obtener la org del usuario
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (orgError || !org) {
    return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 })
  }

  // Llamar a la Partner API de 360dialog para obtener el api_key del canal
  const partnerApiKey = process.env.DIALOG360_API_KEY
  const response = await fetch(
    `https://hub.360dialog.com/api/v2/clients/${client_id}/channels/`,
    {
      headers: {
        'D360-Partner-API-Key': partnerApiKey!,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    const body = await response.text()
    console.error('360dialog API error:', body)
    return NextResponse.json({ error: 'Error al obtener credenciales de 360dialog' }, { status: 502 })
  }

  const { channels } = await response.json()

  if (!channels || channels.length === 0) {
    return NextResponse.json({ error: 'No se encontraron canales para este cliente' }, { status: 404 })
  }

  // Tomamos el primer canal activo
  const channel = channels[0]

  const { error: insertError } = await supabase
    .from('waba_connections')
    .insert({
      org_id: org.id,
      channel_id: channel.id,
      api_key: channel.api_key,
      status: 'active',
    })

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'Este canal ya está conectado' }, { status: 409 })
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
