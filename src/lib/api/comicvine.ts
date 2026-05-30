// ============================================================
// KULTURA — ComicVine API client (cómics)
// SOLO server-side — COMICVINE_KEY nunca al cliente.
// ============================================================

import type { ComicVineSearchResponse } from "@/types/media";

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
