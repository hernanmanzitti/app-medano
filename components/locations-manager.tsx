'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Location {
  id: string
  name: string
  review_link: string
}

interface Props {
  initialLocations: Location[]
}

export function LocationsManager({ initialLocations }: Props) {
  const router = useRouter()
  const [locations, setLocations] = useState<Location[]>(initialLocations)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editLink, setEditLink] = useState('')
  const [newName, setNewName] = useState('')
  const [newLink, setNewLink] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/settings/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, review_link: newLink }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setLocations((prev) => [...prev, data.location])
      setNewName('')
      setNewLink('')
      setShowAddForm(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (loc: Location) => {
    setEditingId(loc.id)
    setEditName(loc.name)
    setEditLink(loc.review_link)
    setError(null)
  }

  const handleSaveEdit = async (id: string) => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/settings/locations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, review_link: editLink }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setLocations((prev) =>
        prev.map((l) => (l.id === id ? { ...l, name: editName, review_link: editLink } : l))
      )
      setEditingId(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminás esta sucursal?')) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/settings/locations/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setLocations((prev) => prev.filter((l) => l.id !== id))
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {locations.length === 0 && !showAddForm && (
        <p className="text-sm text-[#b4b7d9]">Todavía no hay sucursales.</p>
      )}

      {/* Lista */}
      {locations.map((loc) =>
        editingId === loc.id ? (
          <div key={loc.id} className="flex flex-col gap-2 p-3 border border-[#646caa] rounded-md bg-[#eceef8]">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Nombre de la sucursal"
              className="px-3 py-1.5 border border-[#b4b7d9] rounded text-sm text-[#00246b] focus:outline-none focus:ring-2 focus:ring-[#646caa] focus:border-[#646caa] bg-white"
            />
            <input
              type="url"
              value={editLink}
              onChange={(e) => setEditLink(e.target.value)}
              placeholder="https://..."
              className="px-3 py-1.5 border border-[#b4b7d9] rounded text-sm text-[#00246b] focus:outline-none focus:ring-2 focus:ring-[#646caa] focus:border-[#646caa] bg-white"
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleSaveEdit(loc.id)}
                disabled={loading}
                className="px-3 py-1 bg-[#1a4793] hover:bg-[#00246b] text-white text-sm rounded disabled:bg-[#b4b7d9]"
              >
                Guardar
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="px-3 py-1 text-sm text-[#646caa] hover:underline"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div key={loc.id} className="flex items-start justify-between p-3 border border-[#b4b7d9] rounded-md bg-white gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#00246b] truncate">{loc.name}</p>
              <p className="text-xs text-[#b4b7d9] truncate">{loc.review_link}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => startEdit(loc)}
                className="text-sm text-[#1a4793] hover:underline"
              >
                Editar
              </button>
              <button
                onClick={() => handleDelete(loc.id)}
                disabled={loading}
                className="text-sm text-red-500 hover:underline disabled:text-[#b4b7d9]"
              >
                Eliminar
              </button>
            </div>
          </div>
        )
      )}

      {/* Formulario agregar */}
      {showAddForm ? (
        <form onSubmit={handleAdd} className="flex flex-col gap-2 p-3 border border-[#b4b7d9] rounded-md bg-[#f4f5fb]">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            placeholder="Nombre (ej: Sucursal Palermo)"
            className="px-3 py-1.5 border border-[#b4b7d9] rounded text-sm text-[#00246b] focus:outline-none focus:ring-2 focus:ring-[#646caa] focus:border-[#646caa] bg-white placeholder:text-[#b4b7d9]"
          />
          <input
            type="url"
            value={newLink}
            onChange={(e) => setNewLink(e.target.value)}
            required
            placeholder="https://g.page/r/..."
            className="px-3 py-1.5 border border-[#b4b7d9] rounded text-sm text-[#00246b] focus:outline-none focus:ring-2 focus:ring-[#646caa] focus:border-[#646caa] bg-white placeholder:text-[#b4b7d9]"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="px-3 py-1 bg-[#1a4793] hover:bg-[#00246b] text-white text-sm rounded disabled:bg-[#b4b7d9]"
            >
              {loading ? 'Guardando...' : 'Agregar'}
            </button>
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setNewName(''); setNewLink('') }}
              className="px-3 py-1 text-sm text-[#646caa] hover:underline"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="text-sm text-[#1a4793] hover:underline font-medium"
        >
          + Agregar sucursal
        </button>
      )}
    </div>
  )
}
