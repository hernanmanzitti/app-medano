import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const { review_link, forwarding_number, name } = body

  if (review_link === undefined && forwarding_number === undefined && name === undefined) {
    return NextResponse.json(
      { error: 'Al menos un campo requerido: name, review_link o forwarding_number' },
      { status: 400 }
    )
  }

  const updates: Record<string, string | null> = {}

  if (name !== undefined) {
    const trimmedName = typeof name === 'string' ? name.trim() : ''
    if (trimmedName.length < 2 || trimmedName.length > 60) {
      return NextResponse.json(
        { error: 'El nombre debe tener entre 2 y 60 caracteres' },
        { status: 400 }
      )
    }
    updates.name = trimmedName
  }

  if (review_link !== undefined) {
    if (typeof review_link !== 'string' || review_link.trim().length === 0) {
      return NextResponse.json({ error: 'El link de reseña es requerido' }, { status: 400 })
    }
    updates.review_link = review_link.trim()
  }

  if (forwarding_number !== undefined) {
    updates.forwarding_number =
      forwarding_number === null || forwarding_number === ''
        ? null
        : String(forwarding_number).trim()
  }

  const { error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('owner_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
