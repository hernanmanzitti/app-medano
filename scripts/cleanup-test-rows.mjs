// Borra de message_logs las filas de prueba de la carga masiva.
//
// Criterio: phone que empieza en 54911000000 (los números de test 11000000XX,
// que normalizados quedan como 549 + 11000000XX).
//
// Uso:
//   node scripts/cleanup-test-rows.mjs            → dry-run: lista qué borraría
//   node scripts/cleanup-test-rows.mjs --confirm  → borra de verdad
//
// Lee las credenciales de .env.local (SUPABASE_SECRET_KEY bypassea RLS; se
// acepta el nombre viejo SUPABASE_SERVICE_ROLE_KEY como fallback).

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const PHONE_PREFIX = '54911000000'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvLocal() {
  const env = {}
  let raw
  try {
    raw = readFileSync(join(rootDir, '.env.local'), 'utf8')
  } catch {
    console.error('No se pudo leer .env.local en la raíz del proyecto.')
    process.exit(1)
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    // Saca comillas envolventes si las hay
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

const env = loadEnvLocal()
const url = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local.')
  process.exit(1)
}

const confirmed = process.argv.includes('--confirm')
const supabase = createClient(url, serviceKey)

const { data: rows, error: selectError } = await supabase
  .from('message_logs')
  .select('id, customer_name, phone, status, created_at')
  .like('phone', `${PHONE_PREFIX}%`)
  .order('created_at', { ascending: false })

if (selectError) {
  console.error('Error consultando message_logs:', selectError.message)
  process.exit(1)
}

if (!rows || rows.length === 0) {
  console.log(`No hay filas en message_logs con phone que empiece en ${PHONE_PREFIX}.`)
  process.exit(0)
}

console.log(`Filas encontradas con phone ${PHONE_PREFIX}* — ${rows.length}:\n`)
for (const row of rows) {
  console.log(`  ${row.created_at}  ${row.phone}  ${row.status.padEnd(15)}  ${row.customer_name}`)
}
console.log()

if (!confirmed) {
  console.log('DRY-RUN — no se borró nada.')
  console.log('Para borrar de verdad: node scripts/cleanup-test-rows.mjs --confirm')
  process.exit(0)
}

const { error: deleteError, count } = await supabase
  .from('message_logs')
  .delete({ count: 'exact' })
  .like('phone', `${PHONE_PREFIX}%`)

if (deleteError) {
  console.error('Error borrando:', deleteError.message)
  process.exit(1)
}

console.log(`Borradas ${count ?? rows.length} filas.`)
