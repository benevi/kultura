// ============================================================
// KULTURA — Detección de idioma barata (E-SINOPSIS-I18N)
//
// Por qué a mano y no con un servicio: esto NO decide qué se enseña, solo
// decide si HAY QUE PAGAR una traducción. Un acierto ahorra una llamada al
// modelo; un fallo solo la encarece o la evita de más, nunca rompe la ficha.
// Para esa responsabilidad, una tabla de palabras vacías es suficiente y no
// añade ni dependencia ni latencia.
//
// Se apoya en dos señales complementarias:
//   - Palabras funcionales (el/la/de vs the/of/and): son las más frecuentes de
//     cada idioma y casi nunca aparecen en el otro.
//   - Ortografía exclusiva del español (á-ú, ñ, ¿, ¡): decisiva en textos muy
//     cortos, donde apenas hay palabras funcionales que contar.
//
// Devuelve "unknown" cuando no hay señal suficiente (sinopsis de dos palabras,
// japonés, alemán…). "unknown" NO significa "déjalo como está": significa
// "no puedo certificar que ya esté en el idioma pedido", y el llamante
// traduce. Es el lado seguro del error: el usuario pidió que todo se vea en su
// idioma.
// ============================================================

import type { ApiLocale } from "@/lib/api/locale";

export type DetectedLanguage = ApiLocale | "unknown";

/** Palabras funcionales del español que casi nunca aparecen en inglés. */
const ES_STOPWORDS = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al",
  "que", "con", "para", "por", "su", "sus", "se", "en", "más", "pero", "como",
  "cuando", "donde", "desde", "hasta", "sobre", "entre", "es", "son", "ser",
  "está", "están", "este", "esta", "estos", "estas", "ese", "esa", "todo",
  "todos", "también", "sin", "muy", "ya", "porque", "tras", "vida", "años",
  "mundo", "historia", "personaje", "personajes",
]);

/** Palabras funcionales del inglés que casi nunca aparecen en español. */
const EN_STOPWORDS = new Set([
  "the", "of", "and", "to", "in", "is", "that", "with", "for", "as", "on",
  "by", "from", "this", "it", "its", "his", "her", "their", "they", "are",
  "was", "were", "but", "when", "which", "has", "have", "had", "will", "who",
  "after", "before", "into", "about", "then", "than", "been", "being", "she",
  "he", "an", "at", "or", "not", "one", "all", "world", "story", "life",
]);

/** Caracteres que en la práctica solo aparecen en español dentro de este set. */
const SPANISH_ORTHOGRAPHY = /[áéíóúñ¿¡ü]/i;

/**
 * Cuántas palabras funcionales de ventaja necesita un idioma para declararse
 * ganador. Con menos, el texto es demasiado ambiguo (nombres propios, títulos)
 * y se prefiere "unknown" → traducir.
 */
const MIN_MARGIN = 2;

/**
 * Detecta si un texto está en español, en inglés, o no se puede afirmar.
 *
 * Nunca lanza: una entrada vacía o rara devuelve "unknown".
 */
export function detectLanguage(text: string | null | undefined): DetectedLanguage {
  if (!text) return "unknown";

  const words = text
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .split(/[^a-záéíóúñü]+/i)
    .filter(Boolean);

  if (words.length === 0) return "unknown";

  let es = 0;
  let en = 0;
  for (const word of words) {
    if (ES_STOPWORDS.has(word)) es++;
    else if (EN_STOPWORDS.has(word)) en++;
  }

  // La ortografía pesa como varias palabras: en un texto corto con tildes o
  // eñes el idioma está resuelto aunque no haya artículos que contar.
  if (SPANISH_ORTHOGRAPHY.test(text)) es += MIN_MARGIN;

  if (es - en >= MIN_MARGIN) return "es";
  if (en - es >= MIN_MARGIN) return "en";
  return "unknown";
}

/**
 * ¿Hace falta traducir este texto al locale activo?
 *
 * Solo se salta la traducción cuando el idioma detectado COINCIDE con el
 * pedido. Ante la duda se traduce, que es lo que el usuario espera ver.
 */
export function needsTranslation(
  text: string | null | undefined,
  target: ApiLocale
): boolean {
  if (!text || text.trim().length === 0) return false;
  return detectLanguage(text) !== target;
}
