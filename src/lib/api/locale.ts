// ============================================================
// KULTURA — Idioma de las APIs externas (E-TMDB-LOCALE)
//
// Fuente única de verdad para traducir el locale ACTIVO de la app (es | en,
// `src/i18n/routing.ts`) al parámetro de idioma que espera cada proveedor.
//
// Motivo: hasta E-TMDB-LOCALE, `tmdb.ts` fijaba `language=es-ES` en TODA
// petición, así que un usuario en inglés recibía títulos y sinopsis en español.
// El locale ahora viaja explícitamente (parámetro, no estado global) desde el
// Route Handler / Server Component hasta el cliente de API.
//
// Cobertura por proveedor (tabla de decisión de producto, 2026-09-12):
//   - TMDB (movie/tv)      → `language=es-ES | en-US`          ✅ localizado
//   - Google Books (book)  → `langRestrict=es | en`            ✅ localizado
//   - MangaDex (manga)     → `availableTranslatedLanguage[]`   ✅ localizado
//   - AniList (anime)      → inglés/romaji/nativo únicamente     ❌ limitación
//   - ComicVine (comic)    → inglés únicamente                  ❌ limitación
//   - RAWG (game)          → inglés (Steam aporta el idioma en la ficha)
// Las dos limitaciones son aceptadas a nivel de producto: no existe API gratuita
// equivalente con catálogo traducido a ES. Documentado en CLAUDE.md.
// ============================================================

/** Locales soportados por la app (= `routing.locales`). */
export type ApiLocale = "es" | "en";

/** Locale por defecto (= `routing.defaultLocale`). */
export const DEFAULT_API_LOCALE: ApiLocale = "es";

/**
 * Normaliza cualquier entrada (param de ruta, `getLocale()`, header) a un
 * `ApiLocale`. Acepta variantes regionales (`es-ES`, `en_US`, `EN`) y cae al
 * default ante valores desconocidos o ausentes — nunca lanza: un locale raro
 * jamás debe tumbar una petición de catálogo.
 */
export function resolveApiLocale(raw?: string | null): ApiLocale {
  if (!raw) return DEFAULT_API_LOCALE;
  const base = raw.toLowerCase().split(/[-_]/)[0];
  return base === "en" ? "en" : base === "es" ? "es" : DEFAULT_API_LOCALE;
}

/** Locale → `language` de TMDB (`es-ES` | `en-US`). */
export function tmdbLanguage(locale?: string | null): "es-ES" | "en-US" {
  return resolveApiLocale(locale) === "en" ? "en-US" : "es-ES";
}

/**
 * Locale → región TMDB para `watch/providers` (catálogo de streaming por país).
 * `es` → ES; `en` → US. Sin esto un usuario en inglés veía la oferta española.
 */
export function tmdbRegion(locale?: string | null): "ES" | "US" {
  return resolveApiLocale(locale) === "en" ? "US" : "ES";
}

/** Locale → `langRestrict` de Google Books (ISO-639-1). */
export function googleBooksLangRestrict(locale?: string | null): "es" | "en" {
  return resolveApiLocale(locale);
}

/**
 * Locale → códigos de traducción de MangaDex, en orden de preferencia.
 *
 * MangaDex distingue `es` (España) de `es-la` (LatAm) y muchos títulos solo
 * tienen una de las dos → se piden ambas. `en` va SIEMPRE al final como red de
 * seguridad: `availableTranslatedLanguage[]` es un OR, así que incluir inglés
 * evita el catálogo vacío cuando un título no tiene traducción española
 * (degradación explícita, no silenciosa: ver `pickLocalizedText`).
 */
export function mangaDexLanguages(locale?: string | null): string[] {
  return resolveApiLocale(locale) === "en" ? ["en"] : ["es", "es-la", "en"];
}

/**
 * Elige el texto localizado de un diccionario `{ código: texto }` (el shape que
 * MangaDex usa para `title` y `description`).
 *
 * Cadena de fallback: idioma activo (incluidas variantes regionales, p.ej.
 * `es-la` cuando se pide `es`) → inglés → romanización japonesa (`ja-ro`) →
 * primer valor no vacío. Devuelve `undefined` solo si el diccionario está vacío,
 * de modo que un título sin traducción se muestra en su idioma original en vez
 * de desaparecer.
 */
export function pickLocalizedText(
  dict: Record<string, string> | undefined | null,
  locale?: string | null
): string | undefined {
  if (!dict) return undefined;
  const entries = Object.entries(dict).filter(([, v]) => Boolean(v?.trim()));
  if (entries.length === 0) return undefined;

  const wanted = resolveApiLocale(locale);
  const byPrefix = (prefix: string) =>
    entries.find(([code]) => code.toLowerCase().split(/[-_]/)[0] === prefix);

  return (
    byPrefix(wanted)?.[1] ??
    byPrefix("en")?.[1] ??
    entries.find(([code]) => code.toLowerCase() === "ja-ro")?.[1] ??
    entries[0][1]
  );
}
