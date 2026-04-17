'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  initialName: string
}

export function OrgNameForm({ initialName }: Props) {
  const [name, setName] = useState(initialName)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2 || trimmed.length > 60) {
      setError('El nombre debe tener entre 2 y 60 caracteres')
      setStatus('error')
      return
    }
    setStatus('loading')
    setError(null)

    try {
      const res = await fetch('/api/settings/org', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStatus('success')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setStatus('error')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      <div className="flex gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setStatus('idle') }}
          required
          minLength={2}
          maxLength={60}
          placeholder="Nombre de tu negocio"
          className="flex-1 px-3 py-2 border border-[#b4b7d9] rounded-md text-sm text-[#00246b] placeholder:text-[#b4b7d9] focus:outline-none focus:ring-2 focus:ring-[#646caa] focus:border-[#646caa]"
          disabled={status === 'loading'}
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="px-4 py-2 bg-[#1a4793] hover:bg-[#00246b] text-white text-sm rounded-md disabled:bg-[#b4b7d9] font-medium whitespace-nowrap"
        >
          {status === 'loading' ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
      {status === 'success' && (
        <p className="text-sm text-green-600">✓ Nombre guardado correctamente</p>
      )}
    </form>
  )
}
