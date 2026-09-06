'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ParsedContactRow, reapplyApellidoPrimero, chunkArray, MAX_PASTE_ROWS } from '@/lib/parse-contacts'

const CHUNK_SIZE = 10
const META_CONVERSATION_LIMIT = 250

// Centinela para "Sede central" en el <select>: no puede ser '' porque ese
// valor lo usa el placeholder de "todavía no elegí". Se traduce a
// location_id: null al enviar (el back cae al review_link de la org).
const HQ_VALUE = '__sede_central__'

type RowState = 'invalid' | 'optout' | 'duplicate' | 'contacted' | 'corrected' | 'ok'

interface PreviewRow extends ParsedContactRow {
  selected: boolean
  blacklisted: boolean
  duplicateOf: string | null
  lastContactAt: string | null
  lastContactStatus: string | null
}

interface SendResultRow {
  customer_name: string
  phone: string
  status: string
  error?: string
}

interface SendCycleSummary {
  sent: number
  failed: number
}

interface Props {
  parsedRows: ParsedContactRow[]
  totalDataRows: number
  truncated: boolean
  locations: { id: string; name: string }[]
  onCancel: () => void
  onFinished: (result: SendCycleSummary) => void
}

const STATE_BADGE: Record<RowState, { label: string; className: string }> = {
  invalid: { label: 'Inválido', className: 'bg-red-100 text-red-800' },
  optout: { label: 'En opt-out', className: 'bg-gray-200 text-gray-700' },
  duplicate: { label: 'Duplicado', className: 'bg-gray-200 text-gray-700' },
  contacted: { label: 'Ya contactado', className: 'bg-gray-200 text-gray-700' },
  corrected: { label: 'Corregido', className: 'bg-yellow-100 text-yellow-800' },
  ok: { label: 'OK', className: 'bg-green-100 text-green-800' },
}

function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`
}

/**
 * El teléfono original solo aporta cuando los dígitos cambiaron (se sacó el
 * "15", el "54" o el "0"). Si es idéntico al normalizado, repetirlo es ruido.
 */
function originalPhoneDiffers(row: PreviewRow): boolean {
  if (!row.originalPhone) return false
  return row.originalPhone.replace(/\D/g, '') !== (row.phoneLocal ?? '')
}

function computeRowState(row: PreviewRow): { state: RowState; selectable: boolean } {
  if (!row.nameValid || !row.phoneValid) return { state: 'invalid', selectable: false }
  if (row.blacklisted) return { state: 'optout', selectable: false }
  if (row.duplicateOf) return { state: 'duplicate', selectable: false }
  if (row.lastContactAt) return { state: 'contacted', selectable: true }
  if (row.phoneWarning) return { state: 'corrected', selectable: true }
  return { state: 'ok', selectable: true }
}

function recomputeDuplicates(rows: PreviewRow[]): PreviewRow[] {
  const seen = new Map<string, string>()
  return rows.map((r) => {
    if (!r.phoneValid || !r.phoneE164) {
      return r.duplicateOf === null ? r : { ...r, duplicateOf: null }
    }
    const winnerId = seen.get(r.phoneE164)
    if (winnerId) {
      return r.duplicateOf === winnerId ? r : { ...r, duplicateOf: winnerId }
    }
    seen.set(r.phoneE164, r.id)
    return r.duplicateOf === null ? r : { ...r, duplicateOf: null }
  })
}

function getSelectableSelectedRows(rows: PreviewRow[]): PreviewRow[] {
  return rows.filter((r) => r.selected && computeRowState(r).selectable)
}

export function BulkContactPreview({
  parsedRows,
  totalDataRows,
  truncated,
  locations,
  onCancel,
  onFinished,
}: Props) {
  const [rows, setRows] = useState<PreviewRow[] | null>(null)
  const [apellidoPrimero, setApellidoPrimero] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [sentLast24h, setSentLast24h] = useState(0)

  // Sucursal del lote. Si la org tiene locations arranca SIN elegir: un default
  // se lee como respuesta válida, y el operador que no lo toca manda el lote
  // entero al link de Google equivocado sin haber decidido nada.
  const [locationSelection, setLocationSelection] = useState('')

  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [lastCycle, setLastCycle] = useState<SendCycleSummary | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  // Patrón estándar de fetch-on-mount: la función que llama a setState vive
  // definida e invocada DENTRO del efecto, para que quede claro que esas
  // llamadas ocurren después del await, no de forma sincrónica al montar.
  // El botón "Reintentar" no toca este efecto directamente — solo limpia el
  // estado y bumpea retryCount para que el efecto se vuelva a disparar.
  useEffect(() => {
    let cancelled = false

    async function run() {
      const withDuplicates = recomputeDuplicates(
        parsedRows.map((r) => ({
          ...r,
          selected: false,
          blacklisted: false,
          duplicateOf: null,
          lastContactAt: null,
          lastContactStatus: null,
        }))
      )

      const phonesToCheck = withDuplicates
        .filter((r) => r.phoneValid && r.phoneE164 && !r.duplicateOf)
        .map((r) => r.phoneE164 as string)

      try {
        const [blacklistRes, historyRes] = await Promise.all([
          fetch('/api/blacklist').then(async (res) => {
            const json = await res.json()
            if (!res.ok) throw new Error(json.error ?? 'Error consultando opt-out')
            return json as { phone: string }[]
          }),
          phonesToCheck.length > 0
            ? fetch('/api/messages/check-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phones: phonesToCheck }),
              }).then(async (res) => {
                const json = await res.json()
                if (!res.ok) throw new Error(json.error ?? 'Error consultando historial')
                return json as {
                  history: Record<string, { lastContactAt: string; status: string }>
                  sentLast24h: number
                }
              })
            : Promise.resolve({
                history: {} as Record<string, { lastContactAt: string; status: string }>,
                sentLast24h: 0,
              }),
        ])

        if (cancelled) return

        const blacklistedPhones = new Set(blacklistRes.map((b) => b.phone.replace(/\D/g, '')))

        const hydrated = withDuplicates.map((r) => {
          const blacklisted = !!r.phoneE164 && blacklistedPhones.has(r.phoneE164)
          const hist = r.phoneE164 ? historyRes.history[r.phoneE164] : undefined
          const candidate: PreviewRow = {
            ...r,
            blacklisted,
            lastContactAt: hist?.lastContactAt ?? null,
            lastContactStatus: hist?.status ?? null,
          }
          const { state } = computeRowState(candidate)
          return { ...candidate, selected: state === 'ok' || state === 'corrected' }
        })

        setSentLast24h(historyRes.sentLast24h ?? 0)
        setRows(hydrated)
      } catch (err) {
        if (cancelled) return
        setCheckError(err instanceof Error ? err.message : 'Error verificando opt-out e historial')
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [parsedRows, retryCount])

  const handleRetry = () => {
    setRows(null)
    setCheckError(null)
    setRetryCount((c) => c + 1)
  }

  useEffect(() => {
    if (!sending) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [sending])

  const summary = useMemo(() => {
    if (!rows) return null
    let ready = 0
    let error = 0
    let duplicate = 0
    let optout = 0
    let contacted = 0
    for (const r of rows) {
      const { state } = computeRowState(r)
      if (state === 'invalid') error++
      else if (state === 'duplicate') duplicate++
      else if (state === 'optout') optout++
      else if (state === 'contacted') contacted++
      else ready++ // ok + corrected
    }
    return { ready, error, duplicate, optout, contacted }
  }, [rows])

  const hasLocations = locations.length > 0
  const locationChosen = !hasLocations || locationSelection !== ''
  const effectiveLocationId =
    locationSelection !== '' && locationSelection !== HQ_VALUE ? locationSelection : null

  const selectedRows = rows ? getSelectableSelectedRows(rows) : []
  const selectableRows = rows ? rows.filter((r) => computeRowState(r).selectable) : []
  const allSelected = selectableRows.length > 0 && selectableRows.every((r) => r.selected)
  const metaLimitWarning = sentLast24h + selectedRows.length > META_CONVERSATION_LIMIT

  const handleToggleSelectAll = () => {
    const next = !allSelected
    setRows((prev) => prev?.map((r) => (computeRowState(r).selectable ? { ...r, selected: next } : r)) ?? null)
  }

  const handleToggleRow = (id: string) => {
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r)) ?? null)
  }

  const handleRemoveRow = (id: string) => {
    setRows((prev) => (prev ? recomputeDuplicates(prev.filter((r) => r.id !== id)) : prev))
  }

  const handleNameChange = (id: string, value: string) => {
    setRows(
      (prev) =>
        prev?.map((r) =>
          r.id === id ? { ...r, name: value, nameValid: value.trim().length >= 2, nameManuallyEdited: true } : r
        ) ?? null
    )
  }

  const handlePhoneChange = (id: string, rawValue: string) => {
    const digits = rawValue.replace(/\D/g, '').slice(0, 10)
    setRows((prev) => {
      if (!prev) return prev
      const updated = prev.map((r) => {
        if (r.id !== id) return r
        const phoneValid = digits.length === 10
        return {
          ...r,
          phoneLocal: digits.length > 0 ? digits : null,
          phoneE164: phoneValid ? `549${digits}` : null,
          phoneValid,
          phoneWarning: undefined,
        }
      })
      return recomputeDuplicates(updated)
    })
  }

  const handleToggleApellidoPrimero = () => {
    const next = !apellidoPrimero
    setApellidoPrimero(next)
    setRows((prev) => {
      if (!prev) return prev
      const renamed = reapplyApellidoPrimero(prev, next)
      return prev.map((r, i) => ({ ...r, name: renamed[i].name, nameValid: renamed[i].nameValid }))
    })
  }

  const handleSend = async () => {
    if (!rows || selectedRows.length === 0 || !locationChosen) return

    setSending(true)
    setLastCycle(null)
    const toSend = selectedRows
    const chunks = chunkArray(toSend, CHUNK_SIZE)
    setProgress({ done: 0, total: toSend.length })

    let sentTotal = 0
    let failedTotal = 0
    const failedIds = new Set<string>()

    for (const chunk of chunks) {
      try {
        const res = await fetch('/api/messages/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contacts: chunk.map((r) => ({ customer_name: r.name, phone: r.phoneLocal })),
            location_id: effectiveLocationId,
          }),
        })
        const data = await res.json()

        if (!res.ok || !Array.isArray(data.results)) {
          failedTotal += chunk.length
          for (const r of chunk) failedIds.add(r.id)
        } else {
          sentTotal += data.sent ?? 0
          failedTotal += data.failed ?? 0
          const failedIdentifiers = new Set(
            (data.results as SendResultRow[])
              .filter((r) => r.status !== 'sent')
              .map((r) => r.phone.replace(/\D/g, ''))
          )
          for (const r of chunk) {
            const localMatch = r.phoneLocal && failedIdentifiers.has(r.phoneLocal)
            const e164Match = r.phoneE164 && failedIdentifiers.has(r.phoneE164)
            if (localMatch || e164Match) failedIds.add(r.id)
          }
        }
      } catch (err) {
        console.error('Chunk de envío falló por completo:', err)
        failedTotal += chunk.length
        for (const r of chunk) failedIds.add(r.id)
      }
      setProgress((p) => (p ? { done: Math.min(p.done + chunk.length, p.total), total: p.total } : p))
    }

    // Las filas enviadas OK salen de la tabla. Las fallidas quedan, ya
    // seleccionadas, para que "Enviar" las vuelva a intentar sin volver a
    // pegar la planilla.
    setRows((prev) =>
      prev
        ? recomputeDuplicates(
            prev
              .filter((r) => !toSend.some((s) => s.id === r.id) || failedIds.has(r.id))
              .map((r) => (failedIds.has(r.id) ? { ...r, selected: true } : r))
          )
        : prev
    )

    setSending(false)
    setProgress(null)
    setLastCycle({ sent: sentTotal, failed: failedTotal })
  }

  const handleClose = () => {
    onFinished(lastCycle ?? { sent: 0, failed: 0 })
  }

  if (checkError) {
    return (
      <div className="p-4 border border-red-300 bg-red-50 rounded-md space-y-3">
        <p className="text-sm text-red-700">{checkError}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleRetry}
            className="px-4 py-1.5 bg-[#1a4793] hover:bg-[#00246b] text-white rounded-md text-sm font-medium"
          >
            Reintentar verificación
          </button>
          <button type="button" onClick={onCancel} className="px-4 py-1.5 text-sm text-[#646caa] hover:text-[#1a4793]">
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  if (!rows) {
    return (
      <div className="p-4 border border-[#b4b7d9] rounded-md text-sm text-[#646caa] text-center">
        Verificando opt-out e historial de envíos…
      </div>
    )
  }

  const nothingLeft = rows.length === 0

  return (
    <div className="space-y-3 border border-[#b4b7d9] rounded-md p-4 bg-white">
      {truncated && (
        <div className="p-3 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded text-sm">
          Pegaste {totalDataRows} filas. Se cargaron las primeras {MAX_PASTE_ROWS} — las{' '}
          {totalDataRows - MAX_PASTE_ROWS} restantes quedaron afuera. Enviá estas y pegá el resto en una segunda
          tanda.
        </div>
      )}

      {hasLocations ? (
        <div>
          <label htmlFor="bulk-location" className="block text-sm font-medium text-[#1a4793] mb-1">
            Sucursal <span className="text-red-600">*</span>
          </label>
          <select
            id="bulk-location"
            value={locationSelection}
            onChange={(e) => setLocationSelection(e.target.value)}
            disabled={sending}
            className="w-full px-3 py-2 border border-[#b4b7d9] rounded-md focus:outline-none focus:ring-2 focus:ring-[#646caa] focus:border-[#646caa] text-sm bg-white text-[#1a4793] disabled:opacity-40"
          >
            <option value="" disabled>
              Elegí una sucursal…
            </option>
            <option value={HQ_VALUE}>Sede central</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-[#646caa] mt-1">Aplica a todos los contactos de este lote.</p>
        </div>
      ) : (
        <p className="text-sm text-[#1a4793]">
          Vas a enviar a <strong>Sede central</strong> — aplica a todos los contactos de este lote.
        </p>
      )}

      {nothingLeft ? (
        <div className="text-center py-6 space-y-3">
          <p className="text-lg font-semibold text-[#00246b]">
            {lastCycle?.sent ?? 0} enviado{(lastCycle?.sent ?? 0) !== 1 ? 's' : ''}
          </p>
          <p className="text-sm text-[#646caa]">No quedan contactos pendientes en este lote.</p>
          <button
            onClick={handleClose}
            className="px-5 py-2 bg-[#1a4793] hover:bg-[#00246b] text-white rounded-md font-medium text-sm"
          >
            Cerrar
          </button>
        </div>
      ) : (
        <>
          {lastCycle && (
            <div className="p-3 bg-[#f4f5fb] border border-[#b4b7d9] rounded text-sm text-[#1a4793]">
              Último intento: {lastCycle.sent} enviado{lastCycle.sent !== 1 ? 's' : ''}, {lastCycle.failed} fallido
              {lastCycle.failed !== 1 ? 's' : ''}. Los fallidos quedaron seleccionados abajo para reintentar.
            </div>
          )}

          {metaLimitWarning && (
            <div className="p-3 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded text-sm">
              Vas a enviar {selectedRows.length} mensajes y ya se enviaron {sentLast24h} en las últimas 24hs — juntos
              superan el límite de {META_CONVERSATION_LIMIT} conversaciones únicas que permite Meta por WABA. No se
              bloquea el envío, pero podrías tener mensajes rechazados.
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <label className="flex items-center gap-2 text-sm text-[#1a4793] whitespace-nowrap shrink-0">
              <input
                type="checkbox"
                checked={apellidoPrimero}
                onChange={handleToggleApellidoPrimero}
                disabled={sending}
                className="rounded border-[#b4b7d9] shrink-0"
              />
              El apellido viene primero
            </label>

            {summary && (
              <p className="text-xs text-[#646caa]">
                {[
                  plural(summary.ready, 'listo', 'listos'),
                  `${summary.error} con error`,
                  plural(summary.duplicate, 'duplicado', 'duplicados'),
                  `${summary.optout} en opt-out`,
                  plural(summary.contacted, 'ya contactado', 'ya contactados'),
                ].join(' · ')}
              </p>
            )}
          </div>

          {/* min-w 600px = 40 (check) + 180 (nombre, el mínimo) + 200 (tel) +
              140 (estado) + 40 (X). En desktop la fila entra entera y el nombre
              se queda con el sobrante; el scroll horizontal aparece solo en
              viewports más angostos que eso. */}
          <div className="overflow-x-auto border border-[#b4b7d9] rounded-md">
            <table className="w-full text-sm table-fixed min-w-[600px]">
              <colgroup>
                <col className="w-10" />
                <col />
                <col className="w-[200px]" />
                <col className="w-[140px]" />
                <col className="w-10" />
              </colgroup>
              <thead>
                <tr className="border-b border-[#b4b7d9] text-left text-xs text-[#646caa] uppercase tracking-wide bg-[#f4f5fb]">
                  <th className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={handleToggleSelectAll}
                      disabled={sending || selectableRows.length === 0}
                      className="rounded border-[#b4b7d9]"
                      aria-label="Seleccionar todos"
                    />
                  </th>
                  <th className="px-2 py-2">Nombre</th>
                  <th className="px-2 py-2">Teléfono</th>
                  <th className="px-2 py-2">Estado</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eceef8]">
                {rows.map((row) => {
                  const { state, selectable } = computeRowState(row)
                  const badge = STATE_BADGE[state]
                  return (
                    <tr key={row.id} className="align-top">
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={row.selected && selectable}
                          onChange={() => handleToggleRow(row.id)}
                          disabled={sending || !selectable}
                          className="rounded border-[#b4b7d9] mt-1"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) => handleNameChange(row.id, e.target.value)}
                          disabled={sending}
                          className="w-full px-2 py-1 border border-[#b4b7d9] rounded text-sm text-[#00246b]"
                        />
                        {row.originalName && (
                          <p className="text-[11px] text-[#b4b7d9] mt-0.5 truncate">{row.originalName}</p>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1">
                          <span className="shrink-0 px-1.5 py-1 bg-[#f4f5fb] border border-[#b4b7d9] rounded text-xs text-[#646caa] select-none">
                            +549
                          </span>
                          <input
                            type="tel"
                            value={row.phoneLocal ?? ''}
                            onChange={(e) => handlePhoneChange(row.id, e.target.value)}
                            maxLength={10}
                            disabled={sending}
                            className="w-full min-w-0 px-2 py-1 border border-[#b4b7d9] rounded text-sm text-[#00246b]"
                          />
                        </div>
                        {originalPhoneDiffers(row) && (
                          <p className="text-[11px] text-[#b4b7d9] mt-0.5 truncate">{row.originalPhone}</p>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {/* El warning de "Corregido" es informativo → tooltip.
                            La fecha de "Ya contactado" es con lo que el operador
                            decide si tilda la fila → siempre visible. */}
                        <span
                          className={`inline-block whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}
                          title={state === 'corrected' ? row.phoneWarning : undefined}
                        >
                          {badge.label}
                        </span>
                        {state === 'contacted' && row.lastContactAt && (
                          <p className="text-[11px] text-[#646caa] mt-0.5 whitespace-nowrap">
                            {format(new Date(row.lastContactAt), 'd MMM yyyy', { locale: es })}
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.id)}
                          disabled={sending}
                          className="text-[#b4b7d9] hover:text-red-500 disabled:opacity-40 text-base leading-none"
                          aria-label="Eliminar contacto"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {sending && progress && (
            <div className="space-y-1">
              <div className="w-full bg-[#eceef8] rounded-full h-2">
                <div
                  className="bg-[#1a4793] h-2 rounded-full transition-all"
                  style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-[#646caa] text-center">
                Enviando {progress.done} de {progress.total}…
              </p>
            </div>
          )}

          {!locationChosen && (
            <p className="text-xs text-[#646caa]">Elegí una sucursal para habilitar el envío.</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={sending}
              className="flex-1 py-2.5 border border-[#b4b7d9] text-[#1a4793] rounded-md hover:bg-[#f4f5fb] disabled:opacity-40 font-medium text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || selectedRows.length === 0 || !locationChosen}
              className="flex-1 bg-[#1a4793] hover:bg-[#00246b] text-white py-2.5 rounded-md disabled:bg-[#b4b7d9] font-medium text-sm"
            >
              {sending
                ? 'Enviando...'
                : lastCycle
                  ? `Reintentar fallidos (${selectedRows.length})`
                  : `Enviar (${selectedRows.length})`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
