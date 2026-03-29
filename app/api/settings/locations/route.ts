import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { name, review_link } = await request.json()

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
  }
  if (!review_link || typeof review_link !== 'string' || review_link.trim().length === 0) {
    return NextResponse.json({ error: 'El link de reseña es requerido' }, { status: 400 })
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!org) return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 })

  const { data: location, error } = await supabase
    .from('locations')
    .insert({ org_id: org.id, name: name.trim(), review_link: review_link.trim() })
    .select('id, name, review_link')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ location }, { status: 201 })
}
