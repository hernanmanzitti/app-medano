import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { OrgReviewLinkForm } from '@/components/org-review-link-form'
import { LocationsManager } from '@/components/locations-manager'
import { ForwardingNumberForm } from '@/components/forwarding-number-form'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, review_link, forwarding_number')
    .eq('owner_id', user.id)
    .single()

  if (!org) redirect('/onboarding')

  const { data: locations } = await supabase
    .from('locations')
    .select('id, name, review_link')
    .eq('org_id', org.id)
    .order('created_at', { ascending: true })

  return (
    <main className="max-w-xl mx-auto px-6 py-10 space-y-10">

      <section>
        <h2 className="text-base font-semibold text-[#00246b] mb-1">Link de reseña</h2>
        <p className="text-sm text-[#646caa] mb-4">
          Ingresá el link de Google de tu negocio para que tus clientes puedan dejar una reseña. Si tenés una sola sucursal, este es el link que se usará en todos los mensajes.
        </p>
        <OrgReviewLinkForm initialReviewLink={org.review_link} />
      </section>

      <hr className="border-[#b4b7d9]" />

      <section>
        <h2 className="text-base font-semibold text-[#00246b] mb-1">Sucursales</h2>
        <p className="text-sm text-[#646caa] mb-4">
          Cada sucursal tiene su propio link de reseña.
        </p>
        <LocationsManager initialLocations={locations ?? []} />
      </section>

      <hr className="border-[#b4b7d9]" />

      <section>
        <h2 className="text-base font-semibold text-[#00246b] mb-1">Derivación de respuestas</h2>
        <p className="text-sm text-[#646caa] mb-4">
          Ingresá un número de WhatsApp de tu empresa que usás con frecuencia para atender clientes. Lo usaremos en caso de que un cliente, en lugar de hacer click para dejar una reseña, se equivoque y responda al mensaje. Le diremos que te envíe un mensaje al teléfono que ingreses aquí.
        </p>
        <ForwardingNumberForm initialForwardingNumber={org.forwarding_number ?? null} />
      </section>

    </main>
  )
}
