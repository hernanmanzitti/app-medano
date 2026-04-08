import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { UserNav } from '@/components/user-nav'
import { SendReviewForm } from '@/components/send-review-form'
import { MessageLogsTable } from '@/components/message-logs-table'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, review_link')
    .eq('owner_id', user!.id)
    .single()

  if (!org) redirect('/onboarding')

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [{ data: locations }, { data: logs }] = await Promise.all([
    supabase
      .from('locations')
      .select('id, name')
      .eq('org_id', org.id)
      .order('created_at', { ascending: true }),
    serviceClient
      .from('message_logs')
      .select('id, customer_name, phone, status, created_at, location_id')
      .eq('org_id', org.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const logsWithLocation = (logs ?? []).map(log => ({
    ...log,
    locations: log.location_id
      ? [{ name: locations?.find(l => l.id === log.location_id)?.name ?? null }]
      : null,
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">{org.name}</h1>
        <div className="flex items-center gap-4">
          <Link href="/dashboard/settings" className="text-sm text-gray-500 hover:text-gray-800">
            Ajustes
          </Link>
          <UserNav />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-10">
        {!org.review_link && (
          <div className="p-3 bg-amber-50 border border-amber-300 text-amber-800 rounded text-sm">
            ⚠️ Todavía no configuraste el link de reseña.{' '}
            <Link href="/dashboard/settings" className="underline font-medium">
              Configurarlo ahora
            </Link>
          </div>
        )}

        {/* Formulario de envío */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-5">Nueva solicitud de reseña</h2>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <SendReviewForm locations={locations ?? []} />
          </div>
        </section>

        {/* Historial */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-5">Solicitudes enviadas</h2>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <MessageLogsTable logs={logsWithLocation} />
          </div>
        </section>
      </main>
    </div>
  )
}
