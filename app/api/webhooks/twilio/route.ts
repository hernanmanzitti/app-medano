import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  const formData = await request.formData()

  const messageSid = formData.get('MessageSid') as string
  const messageStatus = formData.get('MessageStatus') as string

  if (!messageSid || !messageStatus) {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  // Mapear status de Twilio a nuestro enum
  const statusMap: Record<string, string> = {
    sent: 'sent',
    delivered: 'delivered',
    read: 'read',
    failed: 'failed',
    undelivered: 'failed',
  }

  const mappedStatus = statusMap[messageStatus]
  if (!mappedStatus) {
    // Status que no nos interesa (queued, accepted, etc.) — ignorar
    return NextResponse.json({ ok: true })
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('message_logs')
    .update({
      status: mappedStatus,
      wam_id: messageSid,
    })
    .eq('wam_id', messageSid)

  if (error) {
    console.error('Webhook Twilio — error actualizando message_logs:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
