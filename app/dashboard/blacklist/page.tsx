import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { UserNav } from '@/components/user-nav'
import { BlacklistManager } from '@/components/blacklist-manager'

export default async function BlacklistPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('owner_id', user.id)
    .single()

  if (!org) redirect('/onboarding')

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: items } = await serviceClient
    .from('blacklist')
    .select('id, phone, origin, created_at')
    .eq('org_id', org.id)
    .order('created_at', { ascending: false })

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

      <main className="max-w-xl mx-auto px-6 py-10">
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-1">Lista de opt-out</h2>
          <p className="text-sm text-gray-500 mb-6">
            Los números en esta lista no recibirán mensajes. Se agregan automáticamente cuando
            el usuario responde STOP, o podés agregarlos manualmente.
          </p>
          <BlacklistManager initialItems={items ?? []} />
        </section>
      </main>
    </div>
  )
}
