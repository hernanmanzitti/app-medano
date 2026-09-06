import { describe, it, expect } from 'vitest'
import {
  normalizeFirstName,
  normalizeArPhone,
  parseContacts,
  reapplyApellidoPrimero,
  chunkArray,
  MAX_PASTE_ROWS,
} from './parse-contacts'

describe('normalizeFirstName', () => {
  it('toma el primer token por default', () => {
    expect(normalizeFirstName('JUAN PEDRO', false).name).toBe('Juan')
  })

  it('con coma, toma lo que sigue a la coma sin importar apellidoPrimero', () => {
    expect(normalizeFirstName('PEREZ, JUAN', false).name).toBe('Juan')
    expect(normalizeFirstName('PEREZ, JUAN', true).name).toBe('Juan')
  })

  it('capitaliza con locale es-AR', () => {
    expect(normalizeFirstName('maría josé gonzalez', false).name).toBe('María')
  })

  it('con coma y apellido con partícula antes, usa lo posterior a la coma', () => {
    expect(normalizeFirstName('DE LA TORRE, JUAN', false).name).toBe('Juan')
  })

  it('nombre de un solo token', () => {
    const r = normalizeFirstName('JOSÉ', false)
    expect(r.name).toBe('José')
    expect(r.valid).toBe(true)
  })

  it('token de una sola letra es inválido', () => {
    const r = normalizeFirstName('j', false)
    expect(r.valid).toBe(false)
  })

  it('celda vacía es inválida', () => {
    const r = normalizeFirstName('', false)
    expect(r.valid).toBe(false)
    expect(r.name).toBe('')
  })

  it('capitaliza después de guion', () => {
    expect(normalizeFirstName('ANA-MARIA', false).name).toBe('Ana-Maria')
  })

  it('apellidoPrimero=true toma el segundo token sin coma', () => {
    expect(normalizeFirstName('PEREZ JUAN', true).name).toBe('Juan')
  })

  it('salta partículas cuando el token elegido es una partícula', () => {
    expect(normalizeFirstName('DE JUAN', false).name).toBe('Juan')
  })

  it('conserva el valor original para auditoría', () => {
    expect(normalizeFirstName('JUAN PEDRO', false).original).toBe('JUAN PEDRO')
  })
})

describe('normalizeArPhone', () => {
  it('10 dígitos ya limpios', () => {
    const r = normalizeArPhone('1155441234')
    expect(r.local).toBe('1155441234')
    expect(r.e164).toBe('5491155441234')
    expect(r.warning).toBeUndefined()
  })

  it('con guiones, sin código de país ni 0 (queda 10 dígitos tal cual)', () => {
    const r = normalizeArPhone('15-5544-1234')
    expect(r.local).toBe('1555441234')
    expect(r.e164).toBe('5491555441234')
  })

  it('011 15 5544 1234 → quita 0 inicial y 15', () => {
    const r = normalizeArPhone('011 15 5544 1234')
    expect(r.local).toBe('1155441234')
    expect(r.e164).toBe('5491155441234')
    expect(r.warning).toMatch(/15/)
    expect(r.warning).toMatch(/0/)
  })

  it('+54 9 11 5544-1234 → quita 54 y 9', () => {
    const r = normalizeArPhone('+54 9 11 5544-1234')
    expect(r.local).toBe('1155441234')
    expect(r.e164).toBe('5491155441234')
    expect(r.warning).toMatch(/54/)
  })

  it('5491155441234 (E.164 sin +) → quita 54 y 9', () => {
    const r = normalizeArPhone('5491155441234')
    expect(r.local).toBe('1155441234')
    expect(r.e164).toBe('5491155441234')
  })

  it('(2494) 45-1234 → 10 dígitos, sin warning', () => {
    const r = normalizeArPhone('(2494) 45-1234')
    expect(r.local).toBe('2494451234')
    expect(r.warning).toBeUndefined()
  })

  it('2494451234 → idéntico resultado sin puntuación', () => {
    const r = normalizeArPhone('2494451234')
    expect(r.local).toBe('2494451234')
  })

  it('1234 → inválido, no adivina código de área', () => {
    const r = normalizeArPhone('1234')
    expect(r.local).toBeNull()
    expect(r.e164).toBeNull()
  })

  it('vacío → inválido', () => {
    const r = normalizeArPhone('')
    expect(r.local).toBeNull()
    expect(r.e164).toBeNull()
  })
})

describe('parseContacts', () => {
  it('parsea filas separadas por tab (pegado de Sheets)', () => {
    const raw = 'Juan Perez\t1155441234\nMaria Lopez\t1166778899'
    const { rows, totalDataRows, truncated } = parseContacts(raw)
    expect(totalDataRows).toBe(2)
    expect(truncated).toBe(false)
    expect(rows).toHaveLength(2)
    expect(rows[0].name).toBe('Juan')
    expect(rows[0].phoneLocal).toBe('1155441234')
    expect(rows[1].name).toBe('Maria')
  })

  it('saltea la fila de encabezado', () => {
    const raw = 'Nombre\tTelefono\nJuan Perez\t1155441234'
    const { rows, totalDataRows } = parseContacts(raw)
    expect(totalDataRows).toBe(1)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Juan')
  })

  it('no confunde una fila de datos con encabezado si trae 8+ dígitos', () => {
    const raw = 'Telefono Nuevo\t1155441234'
    const { rows, totalDataRows } = parseContacts(raw)
    expect(totalDataRows).toBe(1)
    expect(rows[0].phoneLocal).toBe('1155441234')
  })

  it('ignora filas vacías', () => {
    const raw = 'Juan Perez\t1155441234\n\n\nMaria Lopez\t1166778899\n'
    const { totalDataRows } = parseContacts(raw)
    expect(totalDataRows).toBe(2)
  })

  it('separa por ; y por , cuando no hay tab', () => {
    const semicolon = parseContacts('Juan Perez;1155441234')
    expect(semicolon.rows[0].phoneLocal).toBe('1155441234')

    const comma = parseContacts('Juan Perez,1155441234')
    expect(comma.rows[0].phoneLocal).toBe('1155441234')
  })

  it('sin separador, detecta "texto + espacios + numero"', () => {
    const { rows } = parseContacts('Juan Perez 1155441234')
    expect(rows[0].name).toBe('Juan')
    expect(rows[0].phoneLocal).toBe('1155441234')
  })

  it('no asume orden de columnas: telefono primero también funciona', () => {
    const { rows } = parseContacts('1155441234\tJuan Perez')
    expect(rows[0].name).toBe('Juan')
    expect(rows[0].phoneLocal).toBe('1155441234')
  })

  it('ignora columnas extra', () => {
    const { rows } = parseContacts('Juan Perez\t1155441234\tCentro\tVIP')
    expect(rows[0].name).toBe('Juan')
    expect(rows[0].phoneLocal).toBe('1155441234')
  })

  it('marca filas inválidas pero las conserva con el valor crudo', () => {
    // 9 dígitos: califica como celda-teléfono (>=8) pero no llega a los 10 finales
    const { rows } = parseContacts('Juan Perez\t115544123')
    expect(rows).toHaveLength(1)
    expect(rows[0].phoneValid).toBe(false)
    expect(rows[0].originalPhone).toBe('115544123')
  })

  it('sin ninguna celda con 8+ dígitos, no hay candidato a teléfono', () => {
    const { rows } = parseContacts('Juan Perez\t1234')
    expect(rows).toHaveLength(1)
    expect(rows[0].phoneValid).toBe(false)
    expect(rows[0].originalPhone).toBe('')
  })

  it('tope de 50 filas: corta y marca truncated', () => {
    const lines = Array.from({ length: 80 }, (_, i) => `Cliente ${i}\t11${String(i).padStart(8, '0')}`)
    const { rows, totalDataRows, truncated } = parseContacts(lines.join('\n'))
    expect(totalDataRows).toBe(80)
    expect(truncated).toBe(true)
    expect(rows).toHaveLength(MAX_PASTE_ROWS)
  })
})

describe('reapplyApellidoPrimero', () => {
  it('re-normaliza sin pisar ediciones manuales', () => {
    const base = parseContacts('Perez Juan\t1155441234\nGarcia Ana\t1166778899').rows
    const edited = base.map((r, i) => (i === 0 ? { ...r, name: 'Editado a mano', nameManuallyEdited: true } : r))

    const result = reapplyApellidoPrimero(edited, true)

    expect(result[0].name).toBe('Editado a mano') // no se pisa
    expect(result[1].name).toBe('Ana') // se re-normaliza con apellidoPrimero=true
  })
})

describe('chunkArray', () => {
  it('divide en grupos del tamaño pedido', () => {
    const items = Array.from({ length: 23 }, (_, i) => i)
    const chunks = chunkArray(items, 10)
    expect(chunks).toHaveLength(3)
    expect(chunks[0]).toHaveLength(10)
    expect(chunks[1]).toHaveLength(10)
    expect(chunks[2]).toHaveLength(3)
  })

  it('array vacío devuelve sin chunks', () => {
    expect(chunkArray([], 10)).toEqual([])
  })
})
