// ============================================================
// KULTURA — Etiquetas de género en el idioma de la página (F-06, DAT-2)
//
// Cada proveedor nombra los géneros a su manera: TMDB los traduce en cine pero
// deja en inglés los combinados de televisión ("Sci-Fi & Fantasy"), y AniList
// y RAWG solo hablan inglés. Resultado medido: el 100 % de los chips de anime
// y juegos de /es/best salía en inglés.
//
// Esto es una capa de PRESENTACIÓN: `MediaItem.genres` sigue llevando el nombre
// del proveedor (lo que se guarda y lo que usa el match, que tiene su propio
// vocabulario en `recommendations/genre-canonical.ts`). Aquí solo se decide
// qué texto se pinta.
//
// Cadena: nombre del proveedor → slug (tablas de cada `*-maps.ts`, o el propio
// texto de una etiqueta ya conocida en cualquiera de los dos idiomas) → texto
// de `discoverFilters.options.genre.<slug>` en el idioma pedido. Lo que no
// está en ninguna tabla se deja como venía: mejor un chip en otro idioma que
// inventar una traducción.
// ============================================================

// SOLO SERVIDOR: importa los JSON de textos completos para leer un subárbol.
// En un componente de cliente inflaría el bundle con todos los mensajes, así
// que no se importa desde archivos "use client" (lo comprueba
// `tests/unit/api/genre-label-maps.test.ts`). En el cliente, los textos de
// género salen de `useTranslations("discoverFilters")`. Cuando el proyecto
// tenga la dependencia `server-only`, añadir aquí `import "server-only"`.
import esMessages from "../../../messages/es.json";
import enMessages from "../../../messages/en.json";
import { resolveApiLocale } from "@/lib/api/locale";
import { TMDB_GENRE_LABEL } from "@/lib/api/tmdb-maps";
import { RAWG_GENRE_LABEL } from "@/lib/api/rawg-maps";
import { ANILIST_GENRE_LABEL } from "@/lib/api/anilist-maps";

/** Solo el subárbol `discoverFilters.options.genre` de cada idioma. */
const LABELS: Record<"es" | "en", Record<string, string>> = {
  es: { ...esMessages.discoverFilters.options.genre },
  en: { ...enMessages.discoverFilters.options.genre },
};

/** minúsculas, sin acentos ni espacios de sobra: la forma de las claves. */
export function normalizeGenreName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Texto de etiqueta (en cualquiera de los dos idiomas) → slug. Así un género
 * que TMDB ya sirve traducido ("Ciencia ficción", "Science Fiction") también
 * se reconoce y se puede pintar en el otro idioma.
 */
const LABEL_TEXT_TO_SLUG: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const table of [LABELS.en, LABELS.es]) {
    for (const [slug, text] of Object.entries(table)) {
      out[normalizeGenreName(text)] ??= slug;
    }
  }
  // Nombres de TMDB que no coinciden con la etiqueta de la app.
  out["science fiction"] = "ciencia-ficcion";
  out["war"] = "belica";
  out["thriller"] = "suspense";
  return out;
})();

/** Slug de etiqueta de un nombre de género, o `null` si no se conoce. */
export function genreLabelSlug(name: string): string | null {
  const key = normalizeGenreName(name);
  return (
    TMDB_GENRE_LABEL[key] ??
    ANILIST_GENRE_LABEL[key] ??
    RAWG_GENRE_LABEL[key] ??
    LABEL_TEXT_TO_SLUG[key] ??
    null
  );
}

/** Un nombre de género en el idioma pedido (o tal cual si no se conoce). */
export function localizeGenreLabel(name: string, locale?: string | null): string {
  const slug = genreLabelSlug(name);
  if (!slug) return name;
  return LABELS[resolveApiLocale(locale)][slug] ?? name;
}

/** Lista de géneros en el idioma pedido, sin repetidos y en el mismo orden. */
export function localizeGenreLabels(
  genres: readonly string[] | undefined | null,
  locale?: string | null
): string[] {
  const out: string[] = [];
  for (const g of genres ?? []) {
    if (typeof g !== "string" || !g.trim()) continue;
    const label = localizeGenreLabel(g, locale);
    if (!out.includes(label)) out.push(label);
  }
  return out;
}
