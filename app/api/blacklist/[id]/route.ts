import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!org) {
    return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 })
  }

  // Verificar que el registro pertenece a la org del usuario antes de eliminar
  const { data: entry } = await getServiceClient()
    .from('blacklist')
    .select('id')
    .eq('id', id)
    .eq('org_id', org.id)
    .single()

  if (!entry) {
    return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })
  }

  const { error } = await getServiceClient()
    .from('blacklist')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
