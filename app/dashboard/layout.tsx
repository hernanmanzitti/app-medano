import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { DashboardSidebar } from '@/components/dashboard-sidebar'
import { SidebarProvider } from '@/components/sidebar-context'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('owner_id', user.id)
    .single()

  if (!org) redirect('/onboarding')

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-[#f4f5fb]">
        <DashboardSidebar orgName={org.name} userEmail={user.email ?? ''} />
        {/* pt-14 en mobile para compensar el top bar fijo */}
        <div className="flex-1 min-w-0 pt-14 md:pt-0">
          {children}
        </div>
      </div>
    </SidebarProvider>
  )
}
