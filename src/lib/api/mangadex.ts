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
import { z, type ZodType } from "zod";
import { ProviderError, providerFetch } from "@/lib/api/http";
import { mangaDexDetailSchema, mangaDexListSchema } from "@/lib/api/schemas/mangadex";

// ── Internal types ────────────────────────────────────────────────────────────

export interface MangaDexManga {
  id: string;
  attributes: {
    title: Record<string, string>; // { "en": "...", "ja": "..." }
    description: Record<string, string>;
    year: number | null;
    status: string;
    tags: {
      /** Id de la etiqueta: el formato (Official Colored…) se reconoce por él. */
      id?: string;
      attributes: {
        name: Record<string, string>;
        group: string;
      };
    }[];
    lastChapter: string | null;
    lastVolume: string | null;
    /** Títulos alternativos, cada uno `{ código: texto }` (DAT-7). */
    altTitles?: Record<string, string>[];
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
/** Contrato mínimo según el endpoint (COD-1); una ruta desconocida no se valida. */
function mangaDexSchemaFor(path: string): ZodType | undefined {
  if (path === "/manga") return mangaDexListSchema;
  if (/^\/manga\/[0-9a-f-]+$/i.test(path)) return mangaDexDetailSchema;
  return undefined;
}

async function mangaDexFetch<T>(
  path: string,
  params: [string, string][] = [],
  schema: ZodType | undefined = mangaDexSchemaFor(path),
  cache?: false
): Promise<T> {
  const url = new URL(`https://api.mangadex.org${path}`);
  for (const [k, v] of params) url.searchParams.append(k, v);
  return providerFetch<T>("mangadex", url.toString(), {
    schema,
    label: path.startsWith("/manga/") ? "/manga/{id}" : path,
    httpError: (status) =>
      new ProviderError("mangadex", "http", `MangaDex ${path} → ${status}`, { status }),
    ...(cache === false ? { cache: false as const } : {}),
  });
}

/** Sonda barata para `/api/health?deep=1`: un solo título, sin caché. */
export async function probeMangaDex(): Promise<void> {
  await mangaDexFetch("/manga", [["limit", "1"]], mangaDexListSchema, false);
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

/**
 * Etiquetas de formato que se excluyen de la BÚSQUEDA (DAT-7). Ids comprobados
 * contra `GET /manga/tag` (2026-10-22). Doujinshi: obras de fans que copaban
 * el top ("attack on titan" daba tres antes que la obra).
 */
export const MANGADEX_DOUJINSHI_TAG = "b13b2a48-c720-44a9-9c77-39c9979373fb";
/** "Official Colored" y "Fan Colored": se dejan, pero detrás de la obra (ver `isMangaVariant`). */
export const MANGADEX_COLORED_TAGS = [
  "320831a8-4026-470b-94f6-8353740e6f04", // Official Colored
  "7b2ce280-79ef-4c09-9b58-12b7c23a9b78", // Fan Colored
] as const;

/**
 * Búsqueda por título (DAT-7):
 *   - `order[relevance]=desc`: sin orden explícito MangaDex devuelve por
 *     última subida de capítulo ("naruto" daba "Renge to Naruto!" primero).
 *   - `excludedTags[]` Doujinshi.
 *   - `contentRating[]` safe + suggestive, como el catálogo (antes la
 *     búsqueda heredaba el defecto de MangaDex, que incluye erotica).
 *   - SIN `availableTranslatedLanguage[]`: quien busca un título concreto
 *     tiene que encontrarlo aunque no tenga traducción al idioma activo (con
 *     el filtro, "akira" y "berserk" no salían). `locale` se conserva en la
 *     firma: el normalizer elige el texto con él.
 */
export async function searchManga(
  query: string,
  offset = 0,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _locale?: string | null
): Promise<MangaDexResponse> {
  return mangaDexFetch<MangaDexResponse>("/manga", [
    ["title", query],
    ["offset", String(offset)],
    ["limit", "20"],
    ["includes[]", "cover_art"],
    ["order[relevance]", "desc"],
    ["excludedTags[]", MANGADEX_DOUJINSHI_TAG],
    ["excludedTagsMode", "OR"],
    ["contentRating[]", "safe"],
    ["contentRating[]", "suggestive"],
  ]);
}

// ── Estadísticas: nota y seguidores (DAT-7) ──────────────────────────────────

export interface MangaDexStats {
  /** Nota bayesiana 0-10 (la que MangaDex usa para ordenar); `undefined` sin votos. */
  rating?: number;
  follows?: number;
}

interface MangaDexStatisticsResponse {
  statistics?: Record<
    string,
    {
      follows?: number | null;
      rating?: { average?: number | null; bayesian?: number | null } | null;
    }
  >;
}

const mangaDexStatisticsSchema = z.looseObject({
  statistics: z.record(z.string(), z.looseObject({})).optional(),
});

/** Las estadísticas cambian despacio: 6 h de caché por lote de ids. */
export const MANGADEX_STATS_REVALIDATE_SECONDS = 6 * 60 * 60;

/**
 * Nota y seguidores de varios mangas en UNA petición (`/statistics/manga`).
 * El listado de `/manga` no trae nota, así que ningún manga la tenía. Un fallo
 * devuelve un mapa vacío: la nota es un extra, no puede tumbar la búsqueda.
 */
export async function getMangaStatistics(
  ids: string[]
): Promise<Map<string, MangaDexStats>> {
  const out = new Map<string, MangaDexStats>();
  const unique = Array.from(new Set(ids.filter(isMangaDexId))).sort();
  if (unique.length === 0) return out;
  const url = new URL("https://api.mangadex.org/statistics/manga");
  for (const id of unique) url.searchParams.append("manga[]", id);
  try {
    const json = await providerFetch<MangaDexStatisticsResponse>("mangadex", url.toString(), {
      schema: mangaDexStatisticsSchema,
      label: "/statistics/manga",
      cache: { revalidate: MANGADEX_STATS_REVALIDATE_SECONDS },
      httpError: (status) =>
        new ProviderError("mangadex", "http", `MangaDex /statistics/manga → ${status}`, { status }),
    });
    for (const [id, stat] of Object.entries(json.statistics ?? {})) {
      const bayesian = stat?.rating?.bayesian;
      const average = stat?.rating?.average;
      // Sin votos MangaDex da `average: null` y una bayesiana que no dice nada.
      const rating =
        typeof average === "number" && average > 0 && typeof bayesian === "number" && bayesian > 0
          ? Math.round(bayesian * 100) / 100
          : undefined;
      out.set(id, {
        rating,
        follows: typeof stat?.follows === "number" ? stat.follows : undefined,
      });
    }
  } catch {
    // Sin estadísticas: se pinta sin nota.
  }
  return out;
}

// ── Títulos (DAT-7) ───────────────────────────────────────────────────────────

/** Todos los títulos alternativos en un solo array (para la relevancia). */
export function mangaAltTitles(raw: MangaDexManga): string[] {
  const out: string[] = [];
  for (const entry of raw.attributes.altTitles ?? []) {
    for (const value of Object.values(entry ?? {})) {
      if (typeof value === "string" && value.trim()) out.push(value.trim());
    }
  }
  return out;
}

function firstAlt(raw: MangaDexManga, codes: string[]): string | undefined {
  for (const code of codes) {
    for (const entry of raw.attributes.altTitles ?? []) {
      const v = entry?.[code];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return undefined;
}

/**
 * Título que se ENSEÑA. MangaDex guarda como título principal la romanización
 * ("Shingeki no Kyojin", "Toukyou Ghoul") y el oficial en `altTitles`. Se
 * prefiere el inglés oficial (el que usan las ediciones de España y de
 * Latinoamérica para la mayoría: Attack on Titan, Death Note, Witch Hat
 * Atelier); los `altTitles` en español de MangaDex son casi siempre
 * traducciones de fans ("Cuaderno de la Muerte") y no se usan para pintar,
 * solo para que la búsqueda en español encuentre la obra.
 *
 * Devuelve también el original si es distinto, para `originalTitle`.
 */
export function mangaDisplayTitle(
  raw: MangaDexManga
): { title?: string; original?: string } {
  const titles = raw.attributes.title ?? {};
  const romaji = titles["ja-ro"] ?? titles["ko-ro"] ?? titles["zh-ro"];
  const main = titles.en ?? romaji ?? Object.values(titles)[0];
  // Solo se cambia cuando el principal es una romanización y hay inglés.
  const english = titles.en ?? (romaji ? firstAlt(raw, ["en"]) : undefined);
  const title = english ?? main;
  const original = romaji && romaji !== title ? romaji : undefined;
  return { title, original };
}

/** Coloreados (oficiales o de fans): la obra en color va detrás de la original. */
export function isMangaVariant(raw: MangaDexManga): boolean {
  return raw.attributes.tags.some((t) => typeof t.id === "string" && (MANGADEX_COLORED_TAGS as readonly string[]).includes(t.id));
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
