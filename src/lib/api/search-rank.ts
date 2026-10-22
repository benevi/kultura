// ============================================================
// KULTURA — Relevancia de la búsqueda (F-13, DAT-9)
//
// Funciones PURAS (sin red) que ordenan resultados de búsqueda frente a la
// consulta. Las usan `search.ts` (cada familia), `aggregate.ts` (`type=all`,
// entre familias) y el autocompletado (`/api/search`).
//
// Criterio, de más a menos peso:
//   1. Escalón de coincidencia del título (exacto, sin espacios, título base
//      antes del subtítulo, empieza por, contiene todas las palabras).
//   2. Penalizaciones que bajan de escalón: edición coloreada, sin portada,
//      título solo en otra escritura cuando la consulta es latina.
//   3. Desempate (< 10 puntos, nunca cruza escalones): el orden del propio
//      proveedor (su relevancia o popularidad) y la popularidad medida
//      (votos, seguidores, números de la serie).
// ============================================================

import type { MediaItem } from "@/types/media";
// ── Relevancia (DAT-9) ───────────────────────────────────────────────────────

/** Artículos iniciales que no cuentan al comparar ("The Sandman" = "sandman"). */
const LEADING_ARTICLES = new Set([
  "the", "a", "an", "el", "la", "los", "las", "un", "una", "le", "les", "l",
]);

// Con el constructor: el `target` de tsconfig no admite el flag `u` en
// literales, y el servidor (Node 20+) sí lo soporta.
const NON_WORD = new RegExp("[^\\p{L}\\p{N}]+", "gu");
const NON_LETTER = new RegExp("[^\\p{L}]", "gu");
const LATIN = new RegExp("\\p{Script=Latin}", "u");

const ROMAN: Record<string, string> = {
  ii: "2", iii: "3", iv: "4", vi: "6", vii: "7", viii: "8", ix: "9",
  xi: "11", xii: "12", xiii: "13", xiv: "14", xv: "15", xvi: "16",
};

/**
 * Palabras normalizadas de un título: sin acentos ni signos, en minúsculas,
 * "×" como "x" (SPY×FAMILY) y romanos de dos o más letras en arábigos
 * ("Baldur's Gate III" = "baldur's gate 3"). `v` y `x` sueltas se quedan:
 * "V for Vendetta" no es "5 for vendetta".
 */
export function titleWords(text: string | undefined | null): string[] {
  if (!text) return [];
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[×✕]/g, " x ")
    .replace(/['’`]/g, "")
    .replace(/&/g, " and ")
    .replace(NON_WORD, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => ROMAN[w] ?? w);
}

function withoutArticle(words: string[]): string[] {
  return words.length > 1 && LEADING_ARTICLES.has(words[0]) ? words.slice(1) : words;
}

/** Identidad de un título para deduplicar ("The Sandman" = "sandman"). */
export function titleIdentity(text: string | undefined | null): string {
  return withoutArticle(titleWords(text)).join("");
}

/**
 * Título "base": lo que va antes del subtítulo o de la edición
 * ("Attack on Titan: No Regrets", "Death Note (Official Colored)",
 * "Dune - Parte dos").
 */
function baseTitle(text: string): string {
  return text.split(/\s*[:(\[【|]\s*|\s+[-–—]\s+/)[0] ?? text;
}

/**
 * Escalones de coincidencia del título con la consulta. Están separados 10
 * puntos para que el desempate (posición del proveedor y popularidad, < 10)
 * nunca haga saltar de escalón.
 */
export const MATCH_TIER = {
  /** Idéntico, artículo incluido ("el hobbit" = "El hobbit"). */
  identical: 110,
  /** Igual sin el artículo inicial ("sandman" = "The Sandman"). */
  exact: 100,
  /** Igual sin espacios ni guiones ("spiderman" = "Spider-Man"). */
  compact: 90,
  /** El título antes del subtítulo es la consulta ("Dune: Parte dos"). */
  base: 80,
  /** Empieza por la consulta ("Tokyo Ghoul:re"). */
  prefix: 70,
  /** Contiene todas las palabras de la consulta. */
  words: 60,
  none: 0,
} as const;

/** Escalón de UN título candidato frente a la consulta. */
export function titleMatchTier(query: string, candidate: string | undefined | null): number {
  if (!candidate) return MATCH_TIER.none;
  const qFull = titleWords(query);
  const cFull = titleWords(candidate);
  const q = withoutArticle(qFull);
  const c = withoutArticle(cFull);
  if (q.length === 0 || c.length === 0) return MATCH_TIER.none;
  const qs = q.join(" ");
  const cs = c.join(" ");
  if (cFull.join(" ") === qFull.join(" ")) return MATCH_TIER.identical;
  if (cs === qs) return MATCH_TIER.exact;
  if (c.join("") === q.join("")) return MATCH_TIER.compact;
  const base = withoutArticle(titleWords(baseTitle(candidate)));
  if (base.length > 0 && base.length < c.length && (base.join(" ") === qs || base.join("") === q.join(""))) {
    return MATCH_TIER.base;
  }
  if (cs.startsWith(`${qs} `)) return MATCH_TIER.prefix;
  const words = new Set(c);
  if (q.every((w) => words.has(w))) return MATCH_TIER.words;
  return MATCH_TIER.none;
}

/** Todos los títulos por los que se puede reconocer un ítem. */
function candidateTitles(item: MediaItem): string[] {
  const meta = item.metadata ?? {};
  const alt = Array.isArray(meta.altTitles)
    ? (meta.altTitles as unknown[]).filter((t): t is string => typeof t === "string")
    : [];
  const native = typeof meta.nativeTitle === "string" ? [meta.nativeTitle] : [];
  return [item.title, item.originalTitle ?? "", ...native, ...alt].filter(Boolean);
}

/** Tiene letras y ninguna latina (japonés, cirílico, coreano…). */
export function isNonLatinTitle(text: string | undefined | null): boolean {
  if (!text) return false;
  const letters = text.replace(NON_LETTER, "");
  return letters.length > 0 && !LATIN.test(letters);
}

/** Señal de popularidad en "votos": cada familia da la suya. */
function popularity(item: MediaItem): number {
  const meta = item.metadata ?? {};
  for (const key of ["voteCount", "ratingsCount", "follows", "members"]) {
    const v = meta[key];
    if (typeof v === "number" && v > 0) return v;
  }
  // Cómic: una serie con 800 números pesa más que una miniserie de 4.
  const issues = meta.issues;
  if (typeof issues === "number" && issues > 0) return issues * 20;
  return 0;
}

/** Posiciones sobre las que se reparte el desempate por orden del proveedor. */
const POSITION_SCALE = 20;

/** Puntuación de un ítem. Exportada para los tests. */
export function relevanceScore(
  query: string,
  item: MediaItem,
  position: number
): number {
  let tier = Math.max(...candidateTitles(item).map((t) => titleMatchTier(query, t)), MATCH_TIER.none);
  const meta = item.metadata ?? {};
  // Coloreados y similares: detrás de la obra original, por encima del resto.
  if (meta.variant === true && tier > MATCH_TIER.none) tier -= 15;
  // Sin portada no se pinta en el catálogo (`requirePoster`): al final.
  if (!item.poster) tier -= 200;
  // Consulta en letras latinas y título solo en otra escritura ("ベルセルク 1"
  // al buscar "berserk"): no es lo que se busca en /es ni en /en.
  if (!isNonLatinTitle(query) && isNonLatinTitle(item.title)) tier -= 40;

  // Desempate dentro del escalón (< 10): el orden del proveedor (su propia
  // relevancia o popularidad) y la popularidad medida.
  // Escala fija (una página de 20): en una lista corta el segundo no pierde
  // la mitad del desempate frente al primero.
  const positional = Math.max(0, 1 - position / POSITION_SCALE);
  const pop = Math.min(1, Math.log10(1 + popularity(item)) / 5);
  const catalog = meta.catalogPublisher === true ? 1 : 0;
  return tier + 3 * positional + 5 * pop + 1.4 * catalog;
}

/**
 * Ordena una lista por relevancia frente a la consulta. Estable: a igualdad
 * de puntuación se conserva el orden del proveedor.
 */
export function rankSearchResults(query: string, items: MediaItem[]): MediaItem[] {
  if (items.length < 2 || !query.trim()) return items;
  return items
    .map((item, i) => ({ item, i, score: relevanceScore(query, item, i) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.item);
}

/**
 * Mezcla listas de varias familias por relevancia (`type=all`). Cada ítem se
 * puntúa con su posición DENTRO de su familia, así el primero de cada una
 * pesa lo mismo de partida y manda la coincidencia del título.
 */
export function mergeByRelevance(query: string, lists: MediaItem[][]): MediaItem[] {
  const scored: { item: MediaItem; score: number; order: number }[] = [];
  let order = 0;
  // Orden de desempate: ronda (posición) y luego familia, como el intercalado.
  const maxLen = lists.reduce((m, l) => Math.max(m, l.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const list of lists) {
      if (i >= list.length) continue;
      scored.push({ item: list[i], score: relevanceScore(query, list[i], i), order: order++ });
    }
  }
  return scored.sort((a, b) => b.score - a.score || a.order - b.order).map((x) => x.item);
}

/** ¿Alguno de sus títulos es exactamente la consulta? */
export function isExactTitleMatch(query: string, item: MediaItem): boolean {
  return candidateTitles(item).some((t) => titleMatchTier(query, t) >= MATCH_TIER.compact);
}
