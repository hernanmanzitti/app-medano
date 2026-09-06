'use client'

import { useState } from 'react'
import { MAX_PASTE_ROWS } from '@/lib/parse-contacts'

interface Props {
  onProcess: (raw: string) => void
  disabled?: boolean
}

export function BulkPastePanel({ onProcess, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  const handleProcess = () => {
    if (text.trim().length === 0) return
    onProcess(text)
    setText('')
    setOpen(false)
  }

  const handleCancel = () => {
    setOpen(false)
    setText('')
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="text-sm text-[#1a4793] hover:text-[#00246b] underline underline-offset-2 disabled:opacity-40 disabled:no-underline"
      >
        Pegar lista desde Excel/Sheets
      </button>

      {open && (
        <div className="mt-2 p-3 border border-[#b4b7d9] rounded-md bg-[#f4f5fb] space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={`Hasta ${MAX_PASTE_ROWS} filas por tanda. Una fila por cliente.\n\nJuan Perez\t1155441234\nMaria Lopez\t1166778899\n\nSin el 15, solo el número local (ej: 1155441234)`}
            className="w-full px-3 py-2 border border-[#b4b7d9] rounded-md focus:outline-none focus:ring-2 focus:ring-[#646caa] focus:border-[#646caa] text-sm text-[#00246b] placeholder:text-[#b4b7d9] font-mono"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-1.5 text-sm text-[#646caa] hover:text-[#1a4793]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleProcess}
              disabled={text.trim().length === 0}
              className="px-4 py-1.5 bg-[#1a4793] hover:bg-[#00246b] text-white rounded-md text-sm font-medium disabled:bg-[#b4b7d9]"
            >
              Procesar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
