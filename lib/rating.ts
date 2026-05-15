const WORD_MAP: Array<[RegExp, number]> = [
  [/^(5|cinco|excelente|perfecto|perfecta|impecable|genial|brillante|increible|increíble)/, 5],
  [/^(4|cuatro|muy\s*bueno|muy\s*buena|muy\s*bien|excelente\s*atenci)/, 4],
  [/^(bueno|buena|bien|ok|okay|dale|todo\s*bien|estuvo\s*bien|buen\s*servicio)/, 4],
  [/^(3|tres|regular|m[aá]s\s*o\s*menos|m[aá]som[eé]nos|as[ií]\s*as[ií]|normal|promedio)/, 3],
  [/^(2|dos|malo|mala|mal|no\s*estuvo\s*bien|podria\s*mejorar|pod[ií]a\s*mejorar)/, 2],
  [/^(1|uno|muy\s*malo|muy\s*mala|muy\s*mal|p[eé]simo|p[eé]sima|horrible|nefasto|nefasta|fatal|desastroso|desastrosa)/, 1],
]

const STAR_EMOJI_RE = /^[⭐🌟★✨]+/u

function countStars(text: string): number | null {
  const match = text.match(STAR_EMOJI_RE)
  if (!match) return null
  // Each emoji is 1 star; count grapheme clusters
  const count = [...match[0]].length
  return count >= 1 && count <= 5 ? count : null
}

function normalizeText(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[.,!?¿¡]+/g, '')       // strip punctuation
    .replace(/\s+/g, ' ')
}

/**
 * Parses a free-text WhatsApp reply and returns a rating from 1 to 5,
 * or null if the message cannot be mapped to a valid score.
 */
export function parseRating(message: string): number | null {
  const raw = message.trim()

  // 1. Star emoji count (before lowercasing, emojis are case-neutral)
  const starCount = countStars(raw)
  if (starCount !== null) return starCount

  const text = normalizeText(raw)

  // 2. "X estrellas" where X is 1-5
  const xStarsMatch = text.match(/^([1-5])\s*estrellas?/)
  if (xStarsMatch) return parseInt(xStarsMatch[1], 10)

  // 3. Leading digit 1-5 followed by space/comma/end
  const leadingDigit = text.match(/^([1-5])(\s|,|$)/)
  if (leadingDigit) return parseInt(leadingDigit[1], 10)

  // 4. Word/phrase map — first match wins
  for (const [pattern, score] of WORD_MAP) {
    if (pattern.test(text)) return score
  }

  return null
}

// ─── Inline smoke tests (run with: npx ts-node lib/rating.ts) ─────────────────
if (require.main === module) {
  const cases: [string, number | null][] = [
    ['5', 5],
    ['4', 4],
    ['3', 3],
    ['2', 2],
    ['1', 1],
    ['cinco', 5],
    ['Excelente', 5],
    ['muy bueno', 4],
    ['Muy buena, la atención fue genial', 4],
    ['bien', 4],
    ['ok', 4],
    ['regular', 3],
    ['malo', 2],
    ['muy malo', 1],
    ['pésimo', 1],
    ['horrible', 1],
    ['⭐⭐⭐⭐⭐', 5],
    ['⭐⭐⭐', 3],
    ['🌟🌟', 2],
    ['5 estrellas', 5],
    ['3 estrellas', 3],
    ['5, fue excelente', 5],
    ['1, no me gustó nada', 1],
    ['hola', null],
    ['gracias', null],
    ['👍', null],
  ]

  let passed = 0
  for (const [input, expected] of cases) {
    const got = parseRating(input)
    const ok = got === expected
    if (!ok) console.error(`FAIL: parseRating("${input}") = ${got}, expected ${expected}`)
    else passed++
  }
  console.log(`${passed}/${cases.length} tests passed`)
}
