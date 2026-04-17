'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Send, Mail, MessageCircle, ChevronLeft, ChevronRight, LogOut } from 'lucide-react'
import { useSidebar } from '@/components/sidebar-context'

interface Props {
  orgName: string
  userEmail: string
}

const NAV_LINKS: { href: string; label: string; icon: React.ReactNode; exact: boolean }[] = [
  { href: '/dashboard', label: 'Pedir reseñas', icon: <Send size={16} />, exact: true },
  { href: '/dashboard/blacklist', label: 'Opt-out', icon: <span className="text-base leading-none">🚫</span>, exact: false },
  { href: '/dashboard/settings', label: 'Configuración', icon: <span className="text-base leading-none">⚙️</span>, exact: false },
]

export function DashboardSidebar({ orgName, userEmail }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { collapsed, toggle } = useSidebar()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  function renderSidebarContent(opts: { isCollapsed?: boolean; onLinkClick?: () => void }) {
    const { isCollapsed = false, onLinkClick } = opts

    return (
      <div className="flex flex-col h-full">
        {/* Logo + org */}
        <div className={`${isCollapsed ? 'px-2 pt-4 pb-3 overflow-hidden flex justify-center' : 'px-6 pt-6 pb-5'}`}>
          <Link href="/dashboard" className="cursor-pointer inline-block">
            <Image
              src="/logo-medano.png"
              alt="Médano"
              width={120}
              height={40}
              className="object-contain"
            />
          </Link>
          {!isCollapsed && (
            <div className="text-[#b4b7d9] text-xs mt-1.5 truncate">{orgName}</div>
          )}
        </div>

        <hr className="border-[#1a4793] mx-4 mb-2" />

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {NAV_LINKS.map(({ href, label, icon, exact }) => (
            <Link
              key={href}
              href={href}
              onClick={onLinkClick}
              title={isCollapsed ? label : undefined}
              className={`flex items-center rounded-md text-sm font-medium transition-colors ${
                isCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
              } ${
                isActive(href, exact)
                  ? 'bg-[#1a4793] text-white'
                  : 'text-[#b4b7d9] hover:text-white hover:bg-[#1a4793]/60'
              }`}
            >
              <span className="shrink-0">{icon}</span>
              {!isCollapsed && label}
            </Link>
          ))}
        </nav>

        {/* Bloque ayuda — oculto en modo colapsado */}
        {!isCollapsed && (
          <div className="px-4 py-4 border-t border-white/10">
            <p className="text-xs text-[#646caa] font-medium mb-2">¿Necesitás ayuda?</p>
            <div className="space-y-0.5">
              <a
                href="mailto:hola@medano.co"
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-[#b4b7d9] hover:text-white hover:bg-[#1a4793]/60 transition-colors"
              >
                <Mail size={15} className="shrink-0" />
                hola@medano.co
              </a>
              <a
                href="https://wa.me/5491173616189"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-[#b4b7d9] hover:text-white hover:bg-[#1a4793]/60 transition-colors"
              >
                <MessageCircle size={15} className="shrink-0" />
                +54 9 11 7361 6189
              </a>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className={`border-t border-[#1a4793] ${isCollapsed ? 'px-2 py-4 flex justify-center' : 'px-4 py-5'}`}>
          {!isCollapsed && (
            <p className="text-xs text-[#b4b7d9] mb-3 truncate">{userEmail}</p>
          )}
          {isCollapsed ? (
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="text-[#b4b7d9] hover:text-white transition-colors p-1"
            >
              <LogOut size={18} />
            </button>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full px-3 py-2 bg-[#1a4793] hover:bg-[#646caa] text-white text-sm rounded-md transition-colors"
            >
              Cerrar sesión
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside
        className={`hidden md:flex flex-col shrink-0 bg-[#00246b] min-h-screen sticky top-0 self-start h-screen relative transition-all duration-200 ease-in-out ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        {renderSidebarContent({ isCollapsed: collapsed })}
        <button
          onClick={toggle}
          aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          aria-expanded={!collapsed}
          className="absolute -right-3 top-6 z-10 w-6 h-6 rounded-full bg-[#1a4793] text-white flex items-center justify-center hover:bg-[#646caa] transition-colors shadow-md"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>

      {/* ── Mobile top bar ──────────────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-[#00246b] px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="cursor-pointer">
          <Image
            src="/logo-medano.png"
            alt="Médano"
            width={90}
            height={30}
            className="object-contain"
          />
        </Link>
        <span className="text-[#b4b7d9] text-sm truncate max-w-[140px]">{orgName}</span>
        <button
          onClick={() => setMobileOpen(true)}
          className="text-white p-1 text-xl leading-none"
          aria-label="Abrir menú"
        >
          ☰
        </button>
      </div>

      {/* ── Mobile overlay sidebar ──────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex"
          onClick={() => setMobileOpen(false)}
        >
          {/* Sidebar panel */}
          <div
            className="w-60 bg-[#00246b] h-full flex flex-col shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end px-4 pt-4 pb-0">
              <button
                onClick={() => setMobileOpen(false)}
                className="text-[#b4b7d9] hover:text-white text-xl leading-none"
                aria-label="Cerrar menú"
              >
                ✕
              </button>
            </div>
            {renderSidebarContent({ isCollapsed: false, onLinkClick: () => setMobileOpen(false) })}
          </div>
          {/* Backdrop */}
          <div className="flex-1 bg-black/40" />
        </div>
      )}
    </>
  )
}
