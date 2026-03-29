'use client'

import { useState } from 'react'

type Status = 'idle' | 'loading' | 'success' | 'error'

export function SendReviewForm() {
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setError(null)

    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_name: customerName, phone }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setStatus('success')
      setCustomerName('')
      setPhone('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setStatus('error')
    }
  }

  const handleReset = () => {
    setStatus('idle')
    setError(null)
  }

  if (status === 'success') {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-3">✅</div>
        <p className="text-lg font-semibold text-gray-900">¡Solicitud enviada!</p>
        <p className="text-sm text-gray-500 mt-1 mb-6">El mensaje llegará en segundos al WhatsApp del cliente.</p>
        <button
          onClick={handleReset}
          className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium text-sm"
        >
          Enviar otra
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3 bg-red-50 border border-red-300 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-1">
          Nombre del cliente
        </label>
        <input
          id="customerName"
          type="text"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          required
          placeholder="Ej: María García"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          disabled={status === 'loading'}
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
          Teléfono
        </label>
        <div className="flex items-center gap-2">
          <span className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-500 select-none">
            +549
          </span>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            required
            placeholder="1155441234"
            maxLength={10}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            disabled={status === 'loading'}
          />
        </div>
        <p className="mt-1 text-xs text-gray-400">Sin el 15, solo el número local (ej: 1155441234)</p>
      </div>

      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full bg-green-600 text-white py-2.5 rounded-md hover:bg-green-700 disabled:bg-gray-400 font-medium text-sm"
      >
        {status === 'loading' ? 'Enviando...' : 'Enviar por WhatsApp'}
      </button>
    </form>
  )
}
