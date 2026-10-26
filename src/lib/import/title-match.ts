// ============================================================
// KULTURA — ¿Es este resultado del proveedor el título de la fila? (F-26)
//
// El riesgo de un importador es emparejar MAL (PRO-3): meter en la biblioteca
// "Dune" (1984) cuando la fila decía "Dune" (2021). Por eso el emparejado por
// título se hace con reglas explícitas y conservadoras, y ante la duda la
// fila queda "sin emparejar" (se ve en el informe y se añade a mano) antes
// que mal emparejada:
//   - Título idéntico tras normalizar (acentos, signos, "&"/"and", artículo
//     inicial) y año igual o ±1 (estrenos en festival / en cada país).
//   - Título muy parecido (≥ 0,85) y el MISMO año.
//   - Sin año en la fila: solo título idéntico y sin otro candidato igual de
//     bueno con distinto año (si hay dos "Halloween", no se adivina).
// ============================================================

/** Artículos iniciales que no cambian el título ("The Matrix" = "Matrix"). */
const LEADING_ARTICLES = /^(the|a|an|el|la|los|las|le|les|il|lo|der|die|das)\s+/

/** Título comparable: minúsculas, sin acentos, sin signos, "&" = "and". */
export function normalizeTitle(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`´]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(LEADING_ARTICLES, '')
    .replace(/\s+/g, ' ')
}

/**
 * Título sin el sufijo de serie de Goodreads ("The Hunger Games (The Hunger
 * Games, #1)" → "The Hunger Games") ni el subtítulo tras ":" cuando se pide.
 */
export function stripSeriesSuffix(title: string): string {
  return title.replace(/\s*\([^()]*#\s*[\d.]+\)\s*$/, '').trim()
}

function bigrams(s: string): Map<string, number> {
  const out = new Map<string, number>()
  const padded = ` ${s} `
  for (let i = 0; i < padded.length - 1; i++) {
    const g = padded.slice(i, i + 2)
    out.set(g, (out.get(g) ?? 0) + 1)
  }
  return out
}

/** Parecido 0-1 entre dos títulos (Dice sobre bigramas de la forma normalizada). */
export function titleSimilarity(a: string, b: string): number {
  const x = normalizeTitle(a)
  const y = normalizeTitle(b)
  if (!x || !y) return 0
  if (x === y) return 1
  const bx = bigrams(x)
  const by = bigrams(y)
  let overlap = 0
  let total = 0
  bx.forEach((n, g) => {
    overlap += Math.min(n, by.get(g) ?? 0)
    total += n
  })
  by.forEach((n) => {
    total += n
  })
  return total === 0 ? 0 : (2 * overlap) / total
}

export interface Candidate<T> {
  value: T
  /** Títulos con los que se compara (título, original, alternativos). */
  titles: Array<string | null | undefined>
  year?: number | null
}

export interface TitleMatch<T> {
  value: T
  similarity: number
  exactYear: boolean
}

const EXACT = 0.999
const CLOSE = 0.85

/**
 * El mejor candidato que encaja con seguridad, o `null`. `candidates` va en
 * el orden del proveedor (relevancia): a igualdad, gana el primero.
 */
export function pickTitleMatch<T>(
  wanted: { title: string; year?: number | null },
  candidates: Array<Candidate<T>>
): TitleMatch<T> | null {
  const scored = candidates.map((c, rank) => {
    const similarity = Math.max(0, ...c.titles.filter((t): t is string => !!t).map((t) => titleSimilarity(wanted.title, t)))
    const delta = wanted.year && c.year ? Math.abs(wanted.year - c.year) : null
    return { c, rank, similarity, delta }
  })

  const accepted = scored.filter(({ similarity, delta }) => {
    if (delta === null) return similarity >= EXACT
    if (delta === 0) return similarity >= CLOSE
    return delta === 1 && similarity >= EXACT
  })
  if (accepted.length === 0) return null

  accepted.sort(
    (a, b) =>
      // Año exacto antes que ±1; luego más parecido; luego el orden del proveedor.
      Number(b.delta === 0) - Number(a.delta === 0) || b.similarity - a.similarity || a.rank - b.rank
  )
  const best = accepted[0]

  // Dos candidatos igual de buenos a un año de distancia (sin ninguno del año
  // exacto): no hay con qué desempatar, así que no se adivina.
  if (best.delta !== 0) {
    const tie = accepted.find((s) => s !== best && s.delta === best.delta && s.similarity >= best.similarity - 0.001)
    if (tie) return null
  }

  // Sin año que desempate: si hay otro candidato idéntico de otro año, no se adivina.
  if (!wanted.year) {
    const rivals = scored.filter(
      (s) => s !== best && s.similarity >= EXACT && s.c.year && best.c.year && s.c.year !== best.c.year
    )
    if (rivals.length > 0) return null
  }
  return { value: best.c.value, similarity: best.similarity, exactYear: best.delta === 0 }
}

/** Apellido (última palabra) de un autor, para comparar "Herbert, Frank" con "Frank Herbert". */
export function authorKey(author: string | null | undefined): string {
  if (!author) return ''
  const name = author.includes(',') ? author.split(',')[0] : author.trim().split(/\s+/).pop() ?? ''
  return normalizeTitle(name)
}
