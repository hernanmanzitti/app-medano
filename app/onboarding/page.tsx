import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { OnboardingWizard } from '@/components/onboarding-wizard'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Si ya completó el onboarding, mandarlo al dashboard
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (org) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Configuración inicial</h1>
          <p className="text-sm text-gray-500 mt-1">Completá estos 2 pasos para empezar.</p>
        </div>
        <OnboardingWizard />
      </div>
    </div>
  )
}
