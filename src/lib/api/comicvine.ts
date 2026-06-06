// ============================================================
// KULTURA — ComicVine API client (cómics)
// SOLO server-side — COMICVINE_KEY nunca al cliente.
// ============================================================

import type { ComicVineIssue, ComicVineSearchResponse } from "@/types/media";
import type { MediaItem } from "@/types/media";
import { normalizeComic } from "@/lib/api/normalizer";
import {
  comicSort,
  comicCoverDateRange,
  mapPublisherSubstrings,
  type ComicFilters,
} from "@/lib/api/comicvine-maps";

/** Respuesta del endpoint de detalle /issue/4000-{id}/ (un único result objeto). */
interface ComicVineIssueResponse {
  status_code: number;
  error: string;
  results: ComicVineIssue | null;
}

const COMICVINE_BASE = "https://comicvine.gamespot.com/api";

/**
 * Lista negra de editoriales de manga. El catálogo de cómics aspira a ser mundial
 * (US + BD europea + UK + ES + LatAm + clásicos), excepto manga, que tiene su propio
 * apartado (MangaDex). En vez de mantener una lista blanca limitada de editoriales
 * occidentales, aceptamos TODA editorial salvo las de manga listadas aquí.
 *
 * Comparación case-insensitive por substring contra el nombre de publisher que
 * ComicVine asocia al volumen. Cubre las grandes japonesas + sus sellos/imprints
 * occidentales que publican manga traducido (Viz, Yen Press, Seven Seas, etc.),
 * además de las principales coreanas (manhwa) y chinas (manhua), que también
 * tienen tratamiento aparte fuera de este catálogo de cómic occidental.
 */
export const MANGA_PUBLISHERS: string[] = [
  // Japón — grandes editoriales
  "Shueisha",
  "Kodansha",
  "Shogakukan",
  "Kadokawa",
  "Square Enix",
  "Hakusensha",
  "Akita Shoten",
  "Futabasha",
  "Houbunsha",
  "Ichijinsha",
  "Coamix",
  "Takeshobo",
  "Shinchosha",
  "Enterbrain",
  "Mag Garden",
  "Media Factory",
  "Flex Comix",
  "Bunkasha",
  "Libre",
  "Tokuma Shoten",
  "Hobby Japan",
  "Gentosha",
  "Leed",
  "Nihon Bungeisha",
  "Kaiohsha",
  "Ohzora",
  "Jive",
  "Frontier Works",
  "Comicsmart",
  "Kill Time Communication",
  "Wani Books",
  "Tobido",
  "Seibido",
  // Sellos/editoriales occidentales que publican manga traducido
  "Viz",
  "Yen Press",
  "Seven Seas",
  "Kodansha USA",
  "Kodansha Comics",
  "Dark Horse Manga",
  "Tokyopop",
  "Vertical",
  "Denpa",
  "J-Novel",
  "Digital Manga",
  "Glénat Manga",
  "Norma Manga",
  // Manhwa (Corea) y manhua (China) — fuera del catálogo de cómic occidental
  "Webtoon",
  "Naver",
  "Daewon",
  "Haksan",
  "Lezhin",
  "Kakao",
  "Tappytoon",
  "Tapas",
  "D&C Media",
  "Redice",
  "Bilibili",
  "Tencent",
  "Kuaikan",
];

const MANGA_PUBLISHERS_LC = MANGA_PUBLISHERS.map((p) => p.toLowerCase());

/** True si el nombre de editorial contiene (case-insensitive) alguna editorial de manga. */
export function isMangaPublisher(name: string): boolean {
  if (!name) return false;
  const lc = name.toLowerCase();
  return MANGA_PUBLISHERS_LC.some((p) => lc.includes(p));
}

/**
 * Lista negra de editoriales/sellos de cómic erótico o pornográfico. Mismo
 * mecanismo que el filtro de manga: comparación case-insensitive por substring
 * contra el publisher que ComicVine asocia al volumen. Cubre los sellos adultos
 * occidentales más comunes en ComicVine. (El hentai japonés ya cae por la lista
 * de manga.)
 */
export const ADULT_PUBLISHERS: string[] = [
  "Eros Comix",
  "Amerotica",
  "NBM Amerotica",
  "Last Gasp",
  "Fantagraphics Eros",
  "FAKKU",
  "Project H",
  "Adult Comics",
  "Hentai",
  "Pink",
  "Erotic",
  "Penthouse Comix",
  "Playboy",
  "Hustler",
  "Sizzle",
  "Class Comics",
  "Bruno Gmünder",
  "NQ Publishers",
  "Slipshine",
];

const ADULT_PUBLISHERS_LC = ADULT_PUBLISHERS.map((p) => p.toLowerCase());

/** True si el nombre de editorial contiene (case-insensitive) algún sello adulto/erótico. */
export function isAdultPublisher(name: string): boolean {
  if (!name) return false;
  const lc = name.toLowerCase();
  return ADULT_PUBLISHERS_LC.some((p) => lc.includes(p));
}

/**
 * Cache module-level volumeId → publisherName. La relación volumen→editorial no
 * cambia nunca, así que se cachea indefinidamente durante la vida del proceso.
 */
const volumePublisherCache = new Map<number, string>();

/** Respuesta del endpoint /volumes/ (lista de volúmenes con su publisher). */
interface ComicVineVolumesResponse {
  status_code: number;
  error: string;
  results:
    | Array<{ id: number; publisher?: { id: number; name: string } | null }>
    | null;
}

function getKey(): string {
  const key = process.env.COMICVINE_KEY;
  if (!key) throw new Error("COMICVINE_KEY no configurada");
  return key;
}

async function comicVineFetch<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${COMICVINE_BASE}${path}`);
  url.searchParams.set("api_key", getKey());
  url.searchParams.set("format", "json");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  // ComicVine rechaza peticiones sin User-Agent identificable.
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "KulturaApp/1.0" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`ComicVine ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * Busca issues de cómic. Usa el endpoint /issues con filtro por nombre,
 * que devuelve la carátula (image) directamente, a diferencia de /search.
 */
export async function searchComics(query: string): Promise<ComicVineSearchResponse> {
  return comicVineFetch<ComicVineSearchResponse>("/issues/", {
    filter: `name:${query}`,
    limit: "20",
    sort: "cover_date:desc",
    field_list: "id,name,issue_number,cover_date,store_date,deck,description,image,volume",
  });
}

/**
 * Detalle de un issue concreto. El recurso ComicVine usa el prefijo de tipo
 * 4000 para los issues: /issue/4000-{externalId}/. Lanza si no hay results.
 */
export async function getComic(externalId: string): Promise<ComicVineIssue> {
  const resp = await comicVineFetch<ComicVineIssueResponse>(
    `/issue/4000-${externalId}/`,
    {
      field_list: "id,name,issue_number,cover_date,store_date,deck,image,volume",
    }
  );
  if (!resp.results) throw new Error(`ComicVine issue ${externalId} sin results`);
  return resp.results;
}

/**
 * Resuelve el publisher de cada volumen vía batch al endpoint /volumes/.
 * El objeto `volume` inline de /issues/ NO incluye publisher, así que hay que
 * pedirlo aparte. Cachea en memoria (volume→publisher es inmutable) y solo
 * pide los ids no cacheados. Devuelve Map<volumeId, publisherName>.
 */
export async function resolveVolumePublishers(
  volumeIds: number[]
): Promise<Map<number, string>> {
  const unique = volumeIds.filter((id, i) => volumeIds.indexOf(id) === i);
  const missing = unique.filter((id) => !volumePublisherCache.has(id));

  if (missing.length > 0) {
    const resp = await comicVineFetch<ComicVineVolumesResponse>("/volumes/", {
      filter: `id:${missing.join("|")}`,
      field_list: "id,publisher",
      limit: "100",
    });
    for (const vol of resp.results ?? []) {
      volumePublisherCache.set(vol.id, vol.publisher?.name ?? "");
    }
    // Marca como vacíos los ids que la API no devolvió, para no re-pedirlos.
    for (const id of missing) {
      if (!volumePublisherCache.has(id)) volumePublisherCache.set(id, "");
    }
  }

  const result = new Map<number, string>();
  for (const id of unique) {
    result.set(id, volumePublisherCache.get(id) ?? "");
  }
  return result;
}

/**
 * Issues recientes ordenados por fecha de portada descendente, excluyendo manga
 * y sellos adultos/eróticos (catálogo mundial de cómic: US + BD europea + UK + ES
 * + clásicos). Fetchea limit=100 para compensar el filtrado y normaliza hasta 20
 * issues. Issues sin publisher resuelto se descartan (la mayoría del manga llega así).
 * Paginado vía offset (page-1)*100.
 */
export async function getRecentComics(
  page: number = 1,
  filters: ComicFilters = {}
): Promise<{ items: MediaItem[]; total: number }> {
  // Con filtros → sort dinámico + filter cover_date si year. Sin filtros →
  // params idénticos a hoy (paridad). genre sigue oculto para comic.
  const params: Record<string, string> = {
    sort: comicSort(filters.sort),
    limit: "100",
    offset: String((page - 1) * 100),
    field_list: "id,name,issue_number,cover_date,store_date,deck,image,volume",
  };
  const coverDate = comicCoverDateRange(filters.year);
  if (coverDate) params.filter = coverDate;

  const resp = await comicVineFetch<ComicVineSearchResponse>("/issues/", params);
  if (!resp.results) return { items: [], total: 0 };

  const volumeIds = resp.results
    .map((issue) => issue.volume?.id)
    .filter((id): id is number => typeof id === "number");
  const publishers = await resolveVolumePublishers(volumeIds);

  // Editorial = post-filtro sobre el publisher resuelto (substring, case-insensitive).
  const publisherSubstrings = mapPublisherSubstrings(filters.editorial).map((p) =>
    p.toLowerCase()
  );

  const nonManga = resp.results.filter((issue) => {
    const publisher = issue.volume?.id
      ? publishers.get(issue.volume.id)
      : undefined;
    // Solo conservamos issues con publisher resuelto que NO sea de manga ni de
    // sello adulto/erótico. Los issues sin publisher (la API no lo devuelve) se
    // descartan: en ComicVine el grueso del manga llega así y se colaba.
    if (!publisher) return false;
    if (isMangaPublisher(publisher) || isAdultPublisher(publisher)) return false;
    // Editorial (si se pidió): mantener solo si el publisher incluye algún substring.
    if (publisherSubstrings.length > 0) {
      const lc = publisher.toLowerCase();
      if (!publisherSubstrings.some((sub) => lc.includes(sub))) return false;
    }
    return true;
  });

  return {
    items: nonManga.slice(0, 20).map(normalizeComic),
    total: resp.number_of_total_results ?? 0,
  };
}
