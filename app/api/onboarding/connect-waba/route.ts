import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await request.json()
  const { org_id, twilio_subaccount_sid, twilio_auth_token, phone_number } = body

  if (!org_id || !twilio_subaccount_sid || !twilio_auth_token || !phone_number) {
    return NextResponse.json(
      { error: 'Campos requeridos: org_id, twilio_subaccount_sid, twilio_auth_token, phone_number' },
      { status: 400 }
    )
  }

  // Verificar que org_id pertenece al usuario autenticado
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', org_id)
    .eq('owner_id', user.id)
    .single()

  if (orgError || !org) {
    return NextResponse.json({ error: 'Organización no encontrada o no autorizada' }, { status: 403 })
  }

  // Verificar credenciales del subaccount con Twilio
  const basicAuth = btoa(`${twilio_subaccount_sid}:${twilio_auth_token}`)
  const twilioRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${twilio_subaccount_sid}.json`,
    {
      headers: {
        Authorization: `Basic ${basicAuth}`,
      },
    }
  )

  if (!twilioRes.ok) {
    const body = await twilioRes.text()
    console.error('Twilio credential check failed:', twilioRes.status, body)
    return NextResponse.json(
      { error: 'Credenciales de Twilio inválidas o subaccount no encontrado' },
      { status: 502 }
    )
  }

  // Guardar en waba_connections con service role (bypass RLS)
  const serviceClient = getServiceClient()
  const { error: upsertError } = await serviceClient
    .from('waba_connections')
    .upsert(
      {
        org_id,
        twilio_subaccount_sid,
        phone_number,
        status: 'active',
        api_key: `twilio_${twilio_subaccount_sid}`,
        channel_id: phone_number,
      },
      { onConflict: 'org_id' }
    )

  if (upsertError) {
    console.error('Supabase upsert error:', upsertError)
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 200 })
}
