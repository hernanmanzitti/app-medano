import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { UserNav } from '@/components/user-nav'
import { SendReviewForm } from '@/components/send-review-form'

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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">{org.name}</h1>
        <UserNav />
      </header>

      <main className="max-w-md mx-auto px-6 py-12">
        {!org.review_link && (
          <div className="mb-6 p-3 bg-amber-50 border border-amber-300 text-amber-800 rounded text-sm">
            ⚠️ Todavía no configuraste el link de reseña.
            Los mensajes no se podrán enviar hasta que lo hagas.
            {/* TODO Fase 4: agregar link a /dashboard/settings */}
          </div>
        )}

        <h2 className="text-xl font-bold text-gray-900 mb-6">Nueva solicitud de reseña</h2>
        <SendReviewForm />
      </main>
    </div>
  )
}
