'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Status = 'idle' | 'loading' | 'success' | 'error'

interface Location {
  id: string
  name: string
}

interface Contact {
  customer_name: string
  phone: string
}

interface BatchResult {
  sent: number
  failed: number
}

interface Props {
  locations: Location[]
}

export function SendReviewForm({ locations }: Props) {
  const router = useRouter()
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [locationId, setLocationId] = useState('')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null)

  const isLoading = status === 'loading'
  const hasContacts = contacts.length > 0
  const hasCurrentContact = customerName.trim().length > 0 && phone.trim().length > 0
  const locationName = locations.find(l => l.id === locationId)?.name ?? 'Sin sucursal'

  const clearContactFields = () => {
    setCustomerName('')
    setPhone('')
  }

  const handleAdd = () => {
    if (!hasCurrentContact) return
    setContacts((prev) => [...prev, { customer_name: customerName.trim(), phone: phone.trim() }])
    clearContactFields()
  }

  const handleRemove = (index: number) => {
    setContacts((prev) => prev.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && hasContacts) {
      e.preventDefault()
      handleAdd()
    }
  }

  const sendBatch = async (payload: { contacts: Contact[] } | { customer_name: string; phone: string; location_id: string | null }) => {
    setStatus('loading')
    setError(null)
    setBatchResult(null)

    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, location_id: locationId || null }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if ('sent' in data) {
        setBatchResult({ sent: data.sent, failed: data.failed })
      }

      setStatus('success')
      setContacts([])
      clearContactFields()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setStatus('error')
    }
  }

  const handleSendOne = async (e: React.FormEvent) => {
    e.preventDefault()
    await sendBatch({ customer_name: customerName, phone, location_id: locationId || null })
  }

  const handleSendAll = async () => {
    await sendBatch({ contacts })
  }

  const handleReset = () => {
    setStatus('idle')
    setError(null)
    setBatchResult(null)
  }

  if (status === 'success') {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-3">✅</div>
        {batchResult ? (
          <>
            <p className="text-lg font-semibold text-[#00246b]">
              {batchResult.sent} enviado{batchResult.sent !== 1 ? 's' : ''}
              {batchResult.failed > 0 && `, ${batchResult.failed} fallido${batchResult.failed !== 1 ? 's' : ''}`}
            </p>
            <p className="text-sm text-[#646caa] mt-1 mb-6">Los mensajes llegarán en segundos al WhatsApp de cada cliente.</p>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold text-[#00246b]">¡Solicitud enviada!</p>
            <p className="text-sm text-[#646caa] mt-1 mb-6">El mensaje llegará en segundos al WhatsApp del cliente.</p>
          </>
        )}
        <button
          onClick={handleReset}
          className="px-5 py-2 bg-[#1a4793] hover:bg-[#00246b] text-white rounded-md font-medium text-sm"
        >
          Enviar otra
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-3 bg-red-50 border border-red-300 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

      {/* Sucursal — fija para todo el batch */}
      {locations.length > 0 && (
        <div>
          <label htmlFor="location" className="block text-sm font-medium text-[#1a4793] mb-1">
            Sucursal
          </label>
          <select
            id="location"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="w-full px-3 py-2 border border-[#b4b7d9] rounded-md focus:outline-none focus:ring-2 focus:ring-[#646caa] focus:border-[#646caa] text-sm bg-white text-[#1a4793]"
            disabled={isLoading}
          >
            <option value="">Sin sucursal (link general)</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Formulario de carga de contacto */}
      <form onSubmit={hasContacts && !hasCurrentContact ? (e) => { e.preventDefault(); handleSendAll() } : hasContacts ? (e) => { e.preventDefault(); handleAdd() } : handleSendOne} className="space-y-4">
        <div>
          <label htmlFor="customerName" className="block text-sm font-medium text-[#1a4793] mb-1">
            Nombre del cliente
          </label>
          <input
            id="customerName"
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Ej: María García"
            className="w-full px-3 py-2 border border-[#b4b7d9] rounded-md focus:outline-none focus:ring-2 focus:ring-[#646caa] focus:border-[#646caa] text-sm text-[#00246b] placeholder:text-[#b4b7d9]"
            disabled={isLoading}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-[#1a4793] mb-1">
            Teléfono
          </label>
          <div className="flex items-center gap-2">
            <span className="px-3 py-2 bg-[#f4f5fb] border border-[#b4b7d9] rounded-md text-sm text-[#646caa] select-none">
              +549
            </span>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              placeholder="1155441234"
              maxLength={10}
              className="flex-1 px-3 py-2 border border-[#b4b7d9] rounded-md focus:outline-none focus:ring-2 focus:ring-[#646caa] focus:border-[#646caa] text-sm text-[#00246b] placeholder:text-[#b4b7d9]"
              disabled={isLoading}
              onKeyDown={handleKeyDown}
            />
          </div>
          <p className="mt-1 text-xs text-[#b4b7d9]">Sin el 15, solo el número local (ej: 1155441234)</p>
        </div>

        <div className="flex gap-2">
          {/* Agregar al batch */}
          <button
            type="button"
            onClick={handleAdd}
            disabled={isLoading || !hasCurrentContact}
            className="flex-1 py-2.5 border border-[#b4b7d9] text-[#1a4793] rounded-md hover:bg-[#f4f5fb] disabled:opacity-40 font-medium text-sm"
          >
            + Agregar
          </button>

          {/* Enviar uno rápido — solo visible cuando la lista está vacía */}
          {!hasContacts && (
            <button
              type="submit"
              disabled={isLoading || !hasCurrentContact}
              className="flex-1 bg-[#1a4793] hover:bg-[#00246b] text-white py-2.5 rounded-md disabled:bg-[#b4b7d9] font-medium text-sm"
            >
              {isLoading ? 'Enviando...' : 'Enviar por WhatsApp'}
            </button>
          )}
        </div>
      </form>

      {/* Lista de contactos agregados */}
      {hasContacts && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[#646caa] uppercase tracking-wide">
            Contactos a enviar ({contacts.length})
          </p>
          <ul className="divide-y divide-[#eceef8] border border-[#b4b7d9] rounded-md overflow-hidden">
            {contacts.map((c, i) => (
              <li key={i} className="flex items-center justify-between px-3 py-2 bg-white text-sm">
                <div className="flex flex-col">
                  <span className="text-[#1a4793] font-medium">{c.customer_name}</span>
                  <span className="text-xs text-[#646caa]">{locationName}</span>
                </div>
                <span className="text-[#646caa] mx-3">+549 {c.phone}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(i)}
                  disabled={isLoading}
                  className="text-[#b4b7d9] hover:text-red-500 disabled:opacity-40 text-base leading-none"
                  aria-label="Eliminar contacto"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={handleSendAll}
            disabled={isLoading}
            className="w-full bg-[#1a4793] hover:bg-[#00246b] text-white py-2.5 rounded-md disabled:bg-[#b4b7d9] font-medium text-sm"
          >
            {isLoading ? 'Enviando...' : `Enviar todos (${contacts.length})`}
          </button>
        </div>
      )}
    </div>
  )
}
