'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface BlacklistEntry {
  id: string
  phone: string
  origin: 'manual' | 'automatic'
  created_at: string
}

interface BlacklistManagerProps {
  initialItems: BlacklistEntry[]
}

export function BlacklistManager({ initialItems }: BlacklistManagerProps) {
  const [items, setItems] = useState<BlacklistEntry[]>(initialItems)
  const [search, setSearch] = useState('')
  const [phone, setPhone] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = items.filter((item) =>
    item.phone.toLowerCase().includes(search.toLowerCase())
  )

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim()) return
    setAdding(true)
    setError(null)

    const res = await fetch('/api/blacklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone.trim(), origin: 'manual' }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Error al agregar el número')
      setAdding(false)
      return
    }

    setItems((prev) => [data, ...prev])
    setPhone('')
    setAdding(false)
  }

  async function handleDelete(id: string, entryPhone: string) {
    if (!window.confirm(`¿Eliminar ${entryPhone} de la lista de opt-out?`)) return

    const res = await fetch(`/api/blacklist/${id}`, { method: 'DELETE' })

    if (!res.ok) {
      const data = await res.json()
      alert(data.error ?? 'Error al eliminar el registro')
      return
    }

    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  return (
    <div className="space-y-6">
      {/* Formulario de agregar */}
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Ej: 1155441234"
          className="flex-1 border border-[#b4b7d9] rounded px-3 py-2 text-sm text-[#00246b] placeholder:text-[#b4b7d9] focus:outline-none focus:ring-2 focus:ring-[#646caa] focus:border-[#646caa]"
          disabled={adding}
        />
        <button
          type="submit"
          disabled={adding || !phone.trim()}
          className="px-4 py-2 bg-[#1a4793] hover:bg-[#00246b] text-white text-sm rounded disabled:bg-[#b4b7d9] disabled:cursor-not-allowed"
        >
          {adding ? 'Agregando…' : 'Agregar número'}
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* Búsqueda */}
      {items.length > 0 && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por número…"
          className="w-full border border-[#b4b7d9] rounded px-3 py-2 text-sm text-[#00246b] placeholder:text-[#b4b7d9] focus:outline-none focus:ring-2 focus:ring-[#646caa] focus:border-[#646caa]"
        />
      )}

      {/* Tabla */}
      {filtered.length === 0 ? (
        <p className="text-sm text-[#646caa] text-center py-6">
          {items.length === 0
            ? 'No hay números en la lista de opt-out.'
            : 'Sin resultados para esa búsqueda.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#b4b7d9] text-left text-[#646caa] text-xs uppercase tracking-wide">
                <th className="pb-2 pr-4 font-medium">Número</th>
                <th className="pb-2 pr-4 font-medium">Origen</th>
                <th className="pb-2 pr-4 font-medium">Fecha</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-b border-[#eceef8] last:border-0">
                  <td className="py-3 pr-4 font-mono text-[#00246b]">+{item.phone}</td>
                  <td className="py-3 pr-4">
                    {item.origin === 'automatic' ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700">
                        automático
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-[#eceef8] text-[#646caa]">
                        manual
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-[#b4b7d9]">
                    {format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => handleDelete(item.id, item.phone)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
