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
 * Issues recientes ordenados por fecha de portada descendente.
 * Paginado vía offset (page-1)*20. Normaliza a MediaItem.
 */
export async function getRecentComics(
  page: number = 1
): Promise<{ items: MediaItem[]; total: number }> {
  const resp = await comicVineFetch<ComicVineSearchResponse>("/issues/", {
    sort: "cover_date:desc",
    limit: "20",
    offset: String((page - 1) * 20),
    field_list: "id,name,issue_number,cover_date,store_date,deck,image,volume",
  });
  if (!resp.results) return { items: [], total: 0 };
  return {
    items: resp.results.map(normalizeComic),
    total: resp.number_of_total_results ?? 0,
  };
}
