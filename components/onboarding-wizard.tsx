'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Step = 1 | 2

const IS_MOCK = process.env.NEXT_PUBLIC_WABA_MOCK === 'true'

export function OnboardingWizard() {
  const [step, setStep] = useState<Step>(1)
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/onboarding/create-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const handleConnectWaba = async () => {
    setError(null)
    setLoading(true)

    if (IS_MOCK) {
      try {
        const res = await fetch('/api/onboarding/connect-waba-mock', { method: 'POST' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        router.push('/dashboard')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
        setLoading(false)
      }
      return
    }

    // Flujo real: redirect a 360dialog OAuth
    const partnerId = process.env.NEXT_PUBLIC_DIALOG360_PARTNER_ID
    const callbackUrl = `${window.location.origin}/onboarding/callback`
    window.location.href = `https://hub.360dialog.com/lp/whatsapp/${partnerId}?redirect_url=${encodeURIComponent(callbackUrl)}`
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Indicador de pasos */}
      <div className="flex items-center mb-8">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
          1
        </div>
        <div className={`flex-1 h-1 mx-2 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
          2
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

      {/* Paso 1: Nombre de la organización */}
      {step === 1 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Nombrá tu organización</h2>
          <p className="text-sm text-gray-500 mb-6">Usá el nombre de tu negocio tal como lo verán tus clientes.</p>

          <form onSubmit={handleCreateOrg} className="space-y-4">
            <div>
              <label htmlFor="orgName" className="block text-sm font-medium text-gray-700">
                Nombre
              </label>
              <input
                id="orgName"
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                placeholder="Ej: Restaurante Don Juan"
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 font-medium"
            >
              {loading ? 'Guardando...' : 'Continuar'}
            </button>
          </form>
        </div>
      )}

      {/* Paso 2: Conectar WABA */}
      {step === 2 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Conectá tu WhatsApp Business</h2>
          {IS_MOCK ? (
            <p className="text-sm text-gray-500 mb-6">
              Modo desarrollo: se va a guardar una conexión de prueba sin pasar por 360dialog.
            </p>
          ) : (
            <p className="text-sm text-gray-500 mb-6">
              Vas a ser redirigido a 360dialog para conectar tu número de WhatsApp Business.
              El proceso tarda menos de 2 minutos.
            </p>
          )}

          <button
            onClick={handleConnectWaba}
            disabled={loading}
            className="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 font-medium flex items-center justify-center gap-2"
          >
            {loading
              ? 'Conectando...'
              : IS_MOCK
              ? 'Simular conexión WABA (mock)'
              : 'Conectar WhatsApp Business'}
          </button>

          {IS_MOCK && (
            <p className="mt-3 text-xs text-amber-600 text-center bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Mock activo — desactivar <code>NEXT_PUBLIC_WABA_MOCK</code> para usar 360dialog real.
            </p>
          )}

          {!IS_MOCK && (
            <p className="mt-4 text-xs text-gray-400 text-center">
              Vas a volver automáticamente a esta app al finalizar.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
