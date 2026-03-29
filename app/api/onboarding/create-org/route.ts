import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { name } = await request.json()

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'El nombre de la organización es requerido' }, { status: 400 })
  }

  const { data: org, error } = await supabase
    .from('organizations')
    .insert({ name: name.trim(), owner_id: user.id })
    .select('id, name')
    .single()

  if (error) {
    // Violación de unique index: el usuario ya tiene una org
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ya tenés una organización creada' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ org }, { status: 201 })
}
