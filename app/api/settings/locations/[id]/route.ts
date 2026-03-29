import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

interface Params {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const { name, review_link } = await request.json()

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
  }
  if (!review_link || typeof review_link !== 'string' || review_link.trim().length === 0) {
    return NextResponse.json({ error: 'El link de reseña es requerido' }, { status: 400 })
  }

  // RLS garantiza que solo el owner puede modificar sus locations
  const { error } = await supabase
    .from('locations')
    .update({ name: name.trim(), review_link: review_link.trim() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params

  const { error } = await supabase
    .from('locations')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
