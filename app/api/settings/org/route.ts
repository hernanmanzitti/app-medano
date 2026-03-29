import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { review_link } = await request.json()

  if (typeof review_link !== 'string' || review_link.trim().length === 0) {
    return NextResponse.json({ error: 'El link de reseña es requerido' }, { status: 400 })
  }

  const { error } = await supabase
    .from('organizations')
    .update({ review_link: review_link.trim() })
    .eq('owner_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
