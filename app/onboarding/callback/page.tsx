import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

interface Props {
  searchParams: Promise<{ client_id?: string }>
}

export default async function OnboardingCallbackPage({ searchParams }: Props) {
  const { client_id } = await searchParams

  if (!client_id) {
    redirect('/onboarding?error=missing_client_id')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Llamar a nuestra API route para guardar la conexión WABA
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/onboarding/connect-waba`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id }),
  })

  if (!res.ok) {
    const { error } = await res.json()
    redirect(`/onboarding?error=${encodeURIComponent(error ?? 'unknown')}`)
  }

  redirect('/dashboard')
}
