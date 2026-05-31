// ============================================================
// KULTURA — ComicVine API client (cómics)
// SOLO server-side — COMICVINE_KEY nunca al cliente.
// ============================================================

import type { ComicVineIssue, ComicVineSearchResponse } from "@/types/media";
import type { MediaItem } from "@/types/media";
import { normalizeComic } from "@/lib/api/normalizer";

/** Respuesta del endpoint de detalle /issue/4000-{id}/ (un único result objeto). */
interface ComicVineIssueResponse {
  status_code: number;
  error: string;
  results: ComicVineIssue | null;
}

const COMICVINE_BASE = "https://comicvine.gamespot.com/api";

/**
 * Lista blanca de editoriales occidentales. Comparación case-insensitive por
 * substring: el feed /issues/ de ComicVine viene saturado de manga, así que solo
 * conservamos issues cuyo volumen pertenece a una de estas editoriales.
 */
export const WESTERN_PUBLISHERS: string[] = [
  "DC Comics",
  "Marvel",
  "Image Comics",
  "Dark Horse",
  "IDW Publishing",
  "BOOM! Studios",
  "Dynamite",
  "Valiant",
  "Fantagraphics",
  "Drawn & Quarterly",
  "Oni Press",
  "Archie Comics",
  "Vertigo",
  "Wildstorm",
  "Top Cow",
];

const WESTERN_PUBLISHERS_LC = WESTERN_PUBLISHERS.map((p) => p.toLowerCase());

/** True si el nombre de editorial contiene (case-insensitive) alguna de la lista blanca. */
export function isWesternPublisher(name: string): boolean {
  if (!name) return false;
  const lc = name.toLowerCase();
  return WESTERN_PUBLISHERS_LC.some((p) => lc.includes(p));
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
 * Issues recientes ordenados por fecha de portada descendente, filtrados a
 * editoriales occidentales. Fetchea limit=100 para compensar el filtrado (el
 * feed viene dominado por manga) y normaliza hasta 20 issues occidentales.
 * Paginado vía offset (page-1)*100.
 */
export async function getRecentComics(
  page: number = 1
): Promise<{ items: MediaItem[]; total: number }> {
  const resp = await comicVineFetch<ComicVineSearchResponse>("/issues/", {
    sort: "cover_date:desc",
    limit: "100",
    offset: String((page - 1) * 100),
    field_list: "id,name,issue_number,cover_date,store_date,deck,image,volume",
  });
  if (!resp.results) return { items: [], total: 0 };

  const volumeIds = resp.results
    .map((issue) => issue.volume?.id)
    .filter((id): id is number => typeof id === "number");
  const publishers = await resolveVolumePublishers(volumeIds);

  const western = resp.results.filter((issue) => {
    const publisher = issue.volume?.id
      ? publishers.get(issue.volume.id)
      : undefined;
    return publisher ? isWesternPublisher(publisher) : false;
  });

  return {
    items: western.slice(0, 20).map(normalizeComic),
    total: resp.number_of_total_results ?? 0,
  };
}
