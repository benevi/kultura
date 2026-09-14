// ============================================================
// KULTURA — MangaDex API Integration
// Cliente de MangaDex API v5. No requiere API key.
// Docs: https://api.mangadex.org/docs/
//
// ESTADO REAL (E-MANGA-SOURCE, 2026-09-13): manga se sirve con MangaDex en
// Descubrir, búsqueda y ficha de detalle (`discover.ts` case "manga",
// `search.ts` y `media/[type]/[id]/page.tsx`). Jikan se conserva SOLO para
// resolver ids legacy: bibliotecas guardadas mientras manga venía de Jikan
// tienen `manga_{mal_id}` (numérico) — `isMangaDexId` distingue la forma del
// id igual que `isOpenLibraryWorkId` para libros.
//
// Idioma (E-MANGADEX-LOCALE): MangaDex es el único proveedor de manga con
// traducciones reales. `availableTranslatedLanguage[]` acota el catálogo a los
// títulos con traducción en el idioma activo (OR entre códigos: `es`, `es-la` y
// `en` como red de seguridad, ver `mangaDexLanguages`), y los campos de texto
// (`title`, `description`) se eligen con `pickLocalizedText`, que cae a inglés y
// luego al idioma original en vez de dejar el campo vacío.
// ============================================================

import { mangaDexLanguages } from "@/lib/api/locale";

// ── Internal types ────────────────────────────────────────────────────────────

export interface MangaDexManga {
  id: string;
  attributes: {
    title: Record<string, string>; // { "en": "...", "ja": "..." }
    description: Record<string, string>;
    year: number | null;
    status: string;
    tags: {
      attributes: {
        name: Record<string, string>;
        group: string;
      };
    }[];
    lastChapter: string | null;
    lastVolume: string | null;
  };
  relationships: {
    type: string;
    id: string;
    attributes?: { fileName?: string };
  }[];
}

export interface MangaDexResponse {
  data: MangaDexManga[];
  total: number;
  offset: number;
}

export interface MangaDexMangaDetail {
  data: MangaDexManga;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getMangaCoverUrl(mangaId: string, filename: string): string {
  return `https://uploads.mangadex.org/covers/${mangaId}/${filename}`;
}

export function extractMangaCover(manga: MangaDexManga): string | undefined {
  const coverRel = manga.relationships.find((r) => r.type === "cover_art");
  if (!coverRel?.attributes?.fileName) return undefined;
  return getMangaCoverUrl(manga.id, coverRel.attributes.fileName);
}

/**
 * Fetch con params REPETIBLES: MangaDex usa arrays estilo PHP
 * (`includes[]=cover_art&availableTranslatedLanguage[]=es&…`), así que no se
 * puede usar un `Record<string,string>` con `set()` — el segundo valor pisaría
 * al primero. Aquí cada entrada es un par y se usa `append`.
 */
async function mangaDexFetch<T>(
  path: string,
  params: [string, string][] = []
): Promise<T> {
  const url = new URL(`https://api.mangadex.org${path}`);
  for (const [k, v] of params) url.searchParams.append(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`MangaDex ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * Pares `availableTranslatedLanguage[]` para el locale activo. Filtra el
 * catálogo a títulos CON traducción disponible (OR entre los códigos), sin
 * dejar la lista vacía cuando no hay versión española: `mangaDexLanguages`
 * incluye `en` al final como red de seguridad.
 */
function translatedLanguageParams(locale?: string | null): [string, string][] {
  return mangaDexLanguages(locale).map(
    (code) => ["availableTranslatedLanguage[]", code] as [string, string]
  );
}

/**
 * true si `id` tiene forma de UUID de MangaDex (formato nativo de sus ids).
 * Los ids legacy de Jikan (bibliotecas guardadas cuando manga venía de Jikan)
 * son numéricos (`mal_id`) — nunca calzan este patrón. Mismo mecanismo que
 * `isOpenLibraryWorkId` en googlebooks.ts.
 */
export function isMangaDexId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function searchManga(
  query: string,
  offset = 0,
  locale?: string | null
): Promise<MangaDexResponse> {
  return mangaDexFetch<MangaDexResponse>("/manga", [
    ["title", query],
    ["offset", String(offset)],
    ["limit", "20"],
    ["includes[]", "cover_art"],
    ...translatedLanguageParams(locale),
  ]);
}

/**
 * Detalle por id. NO se filtra por idioma: pedir un título concreto y recibir
 * 404 porque no tiene traducción al idioma activo sería peor que mostrarlo en
 * su idioma original (`pickLocalizedText` resuelve el texto en el normalizer).
 */
export async function getManga(id: string): Promise<MangaDexMangaDetail> {
  return mangaDexFetch<MangaDexMangaDetail>(`/manga/${id}`, [
    ["includes[]", "cover_art"],
  ]);
}

export async function getPopularManga(
  offset = 0,
  locale?: string | null
): Promise<MangaDexResponse> {
  return mangaDexFetch<MangaDexResponse>("/manga", [
    ["offset", String(offset)],
    ["limit", "20"],
    ["order[followedCount]", "desc"],
    ["includes[]", "cover_art"],
    ["contentRating[]", "safe"],
    ["contentRating[]", "suggestive"],
    ...translatedLanguageParams(locale),
  ]);
}

/**
 * Descubrir manga con filtros nativos (E-MANGA-SOURCE). `nativeParams` viene
 * de `buildMangaDexDiscoverParams` (mangadex-maps.ts) — ya incluye
 * `contentRating[]`, `order[...]` y los filtros traducidos a UUID/valor
 * MangaDex. Aquí solo se añaden paginación, `includes[]=cover_art` e idioma.
 */
export async function discoverManga(
  offset: number,
  nativeParams: [string, string][],
  locale?: string | null
): Promise<MangaDexResponse> {
  return mangaDexFetch<MangaDexResponse>("/manga", [
    ["offset", String(offset)],
    ["limit", "20"],
    ["includes[]", "cover_art"],
    ...nativeParams,
    ...translatedLanguageParams(locale),
  ]);
}
