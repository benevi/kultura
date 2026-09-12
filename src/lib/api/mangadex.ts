// ============================================================
// KULTURA — MangaDex API Integration
// Cliente de MangaDex API v5. No requiere API key.
// Docs: https://api.mangadex.org/docs/
//
// ⚠️ ESTADO REAL (verificado 2026-09-12, E-MANGADEX-LOCALE): este cliente NO
// está en el pipeline en vivo. La familia `manga` de Descubrir, de la búsqueda
// y de la ficha de detalle se sirve HOY con **Jikan** (`getPopularManga` /
// `searchManga` / `getManga` de `@/lib/api/jikan`, ver `discover.ts` case
// "manga", `search.ts` y `media/[type]/[id]/page.tsx`). De este módulo solo se
// consumen `MangaDexManga` + `extractMangaCover` desde `normalizer.ts`.
// La migración de la familia manga a MangaDex (que es lo que desbloquearía de
// verdad el catálogo en español) está registrada como **E-MANGA-SOURCE** en
// `docs/BACKLOG.md`, con el mapeo de filtros y la compatibilidad de ids ya
// especificados. Este módulo queda listo y localizado para ese cambio.
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
    ...translatedLanguageParams(locale),
  ]);
}
