// Parser y normalizadores puros para la carga masiva de contactos por pegado
// (Google Sheets / Excel). Sin dependencias de React ni fetch — testeable con
// vitest sin mocks.

export const MAX_PASTE_ROWS = 50

const PARTICLES = new Set([
  'de', 'del', 'la', 'las', 'los', 'san', 'santa', 'di', 'da', 'van', 'von', 'mc', "o'",
])

const HEADER_REGEX = /nombre|apellido|cliente|tel|celular|whatsapp|phone/i

export interface ParsedContactRow {
  id: string
  originalName: string
  name: string
  nameValid: boolean
  nameManuallyEdited: boolean
  originalPhone: string
  phoneLocal: string | null
  phoneE164: string | null
  phoneValid: boolean
  phoneWarning?: string
}

export interface ParseContactsResult {
  rows: ParsedContactRow[]
  totalDataRows: number
  truncated: boolean
}

export interface NormalizedName {
  name: string
  original: string
  valid: boolean
}

export interface NormalizedPhone {
  local: string | null
  e164: string | null
  warning?: string
}

let idCounter = 0
function nextId(): string {
  idCounter += 1
  return `row-${idCounter}-${Math.random().toString(36).slice(2, 8)}`
}

function digitCount(s: string): number {
  return (s.match(/\d/g) ?? []).length
}

function capitalizeWord(word: string): string {
  if (word.length === 0) return word
  return word.charAt(0).toLocaleUpperCase('es-AR') + word.slice(1).toLocaleLowerCase('es-AR')
}

function capitalizeToken(token: string): string {
  return token.split('-').map(capitalizeWord).join('-')
}

/**
 * De "JUAN PEDRO" saca "Juan". Ver reglas en CLAUDE.md / spec de la feature.
 */
export function normalizeFirstName(raw: string, apellidoPrimero: boolean): NormalizedName {
  const original = raw ?? ''
  const trimmed = original.trim()
  if (trimmed.length === 0) {
    return { name: '', original, valid: false }
  }

  const hasComma = trimmed.includes(',')
  const tokenSource = hasComma
    ? trimmed.split(',').slice(1).join(',').trim()
    : trimmed

  const tokens = tokenSource.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) {
    return { name: '', original, valid: false }
  }

  let idx = 0
  if (!hasComma && apellidoPrimero && tokens.length >= 2) {
    idx = 1
  }

  while (idx < tokens.length - 1 && PARTICLES.has(tokens[idx].toLowerCase())) {
    idx += 1
  }

  const chosen = tokens[idx] ?? ''
  const name = capitalizeToken(chosen)

  return { name, original, valid: name.length >= 2 }
}

/**
 * Normaliza un número argentino a 10 dígitos locales (sin "15", sin "54",
 * sin "9", sin "0" inicial). NO adivina código de área — si no llega a 10
 * dígitos después de la limpieza, la fila queda inválida.
 */
export function normalizeArPhone(raw: string): NormalizedPhone {
  let digits = (raw ?? '').replace(/\D/g, '')

  let removed54 = false
  let removed0 = false
  let removed15 = false

  if (digits.startsWith('00')) {
    digits = digits.slice(2)
  }
  if (digits.startsWith('54')) {
    digits = digits.slice(2)
    removed54 = true
  }
  if (digits.startsWith('9')) {
    digits = digits.slice(1)
  }
  if (digits.startsWith('0')) {
    digits = digits.slice(1)
    removed0 = true
  }

  if (digits.length === 11 || digits.length === 12) {
    for (const pos of [2, 3, 4]) {
      if (digits.slice(pos, pos + 2) === '15') {
        const candidate = digits.slice(0, pos) + digits.slice(pos + 2)
        if (candidate.length === 10) {
          digits = candidate
          removed15 = true
          break
        }
      }
    }
  }

  if (digits.length !== 10) {
    return { local: null, e164: null }
  }

  const warnings: string[] = []
  if (removed15) warnings.push('Se quitó el "15"')
  if (removed54) warnings.push('Se quitó el código de país "54"')
  if (removed0) warnings.push('Se quitó el "0" inicial')

  return {
    local: digits,
    e164: `549${digits}`,
    warning: warnings.length > 0 ? warnings.join(' · ') : undefined,
  }
}

function splitRowIntoCells(line: string): string[] {
  if (line.includes('\t')) return line.split('\t')
  if (line.includes(';')) return line.split(';')
  if (line.includes(',')) return line.split(',')

  // Sin separador: "texto + espacios + número" — el número puede traer
  // +, espacios, guiones o paréntesis, pero termina en dígito.
  const match = line.match(/^(.*?)\s+([+\d][\d\s().+-]{5,}\d)\s*$/)
  if (match) return [match[1], match[2]]
  return [line]
}

function pickPhoneAndName(cells: string[]): { nameRaw: string; phoneRaw: string } {
  const trimmedCells = cells.map((c) => c.trim())
  const phoneIdx = trimmedCells.findIndex((c) => digitCount(c) >= 8)
  const phoneRaw = phoneIdx >= 0 ? trimmedCells[phoneIdx] : ''
  const nameRaw =
    trimmedCells.find((c, i) => i !== phoneIdx && /[a-zA-ZÀ-ÿ]/.test(c)) ??
    trimmedCells.find((c, i) => i !== phoneIdx) ??
    ''
  return { nameRaw, phoneRaw }
}

function splitLines(raw: string): string[] {
  return raw.split(/\r\n|\r|\n/)
}

/**
 * Parsea texto pegado (TSV de Sheets, CSV, o líneas sueltas "Nombre  Telefono")
 * en filas de contacto normalizadas. Tope de MAX_PASTE_ROWS filas por pegado —
 * si se supera, se procesan las primeras y `truncated` queda en true.
 */
export function parseContacts(raw: string, apellidoPrimero = false): ParseContactsResult {
  const nonEmptyLines = splitLines(raw)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  let dataLines = nonEmptyLines
  if (dataLines.length > 0) {
    const first = dataLines[0]
    if (HEADER_REGEX.test(first) && digitCount(first) < 8) {
      dataLines = dataLines.slice(1)
    }
  }

  const totalDataRows = dataLines.length
  const truncated = totalDataRows > MAX_PASTE_ROWS
  const linesToProcess = dataLines.slice(0, MAX_PASTE_ROWS)

  const rows: ParsedContactRow[] = linesToProcess.map((line) => {
    const cells = splitRowIntoCells(line)
    const { nameRaw, phoneRaw } = pickPhoneAndName(cells)
    const nameResult = normalizeFirstName(nameRaw, apellidoPrimero)
    const phoneResult = normalizeArPhone(phoneRaw)

    return {
      id: nextId(),
      originalName: nameRaw,
      name: nameResult.name,
      nameValid: nameResult.valid,
      nameManuallyEdited: false,
      originalPhone: phoneRaw,
      phoneLocal: phoneResult.local,
      phoneE164: phoneResult.e164,
      phoneValid: phoneResult.local !== null,
      phoneWarning: phoneResult.warning,
    }
  })

  return { rows, totalDataRows, truncated }
}

/**
 * Re-normaliza los nombres del lote al togglear "el apellido viene primero",
 * sin pisar las filas que el operador ya editó a mano.
 */
export function reapplyApellidoPrimero(
  rows: ParsedContactRow[],
  apellidoPrimero: boolean
): ParsedContactRow[] {
  return rows.map((row) => {
    if (row.nameManuallyEdited) return row
    const result = normalizeFirstName(row.originalName, apellidoPrimero)
    return { ...row, name: result.name, nameValid: result.valid }
  })
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) throw new Error('chunkArray: size debe ser mayor a 0')
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}
