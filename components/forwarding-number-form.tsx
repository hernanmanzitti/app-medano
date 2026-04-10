'use client'

import { useState } from 'react'

interface Props {
  initialForwardingNumber: string | null
}

export function ForwardingNumberForm({ initialForwardingNumber }: Props) {
  const [value, setValue] = useState(initialForwardingNumber ?? '')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setError(null)

    try {
      const res = await fetch('/api/settings/org', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forwarding_number: value.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStatus('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setStatus('error')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <input
          type="tel"
          value={value}
          onChange={(e) => { setValue(e.target.value); setStatus('idle') }}
          placeholder="+5491155441234"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={status === 'loading'}
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:bg-gray-400 font-medium whitespace-nowrap"
        >
          {status === 'loading' ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
      {status === 'success' && (
        <p className="text-sm text-green-600">✓ Número guardado correctamente</p>
      )}
    </form>
  )
}
