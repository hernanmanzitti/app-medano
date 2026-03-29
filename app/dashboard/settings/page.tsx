import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { UserNav } from '@/components/user-nav'
import { OrgReviewLinkForm } from '@/components/org-review-link-form'
import { LocationsManager } from '@/components/locations-manager'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, review_link')
    .eq('owner_id', user.id)
    .single()

  if (!org) redirect('/onboarding')

  const { data: locations } = await supabase
    .from('locations')
    .select('id, name, review_link')
    .eq('org_id', org.id)
    .order('created_at', { ascending: true })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">
            ← Volver
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">{org.name}</h1>
        </div>
        <UserNav />
      </header>

      <main className="max-w-xl mx-auto px-6 py-10 space-y-10">

        {/* Sección 1: Link de reseña general */}
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-1">Link de reseña</h2>
          <p className="text-sm text-gray-500 mb-4">
            Se usa en los mensajes cuando no hay una sucursal seleccionada.
          </p>
          <OrgReviewLinkForm initialReviewLink={org.review_link} />
        </section>

        <hr className="border-gray-200" />

        {/* Sección 2: Sucursales */}
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-1">Sucursales</h2>
          <p className="text-sm text-gray-500 mb-4">
            Cada sucursal tiene su propio link de reseña.
          </p>
          <LocationsManager initialLocations={locations ?? []} />
        </section>

      </main>
    </div>
  )
}
