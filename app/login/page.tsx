import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { AuthForm } from '@/components/auth-form'

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <AuthForm />
    </div>
  )
}
