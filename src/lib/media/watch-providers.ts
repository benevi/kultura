// ============================================================
// KULTURA — "Dónde ver" de la ficha (PRO-2, PRO-6)
//
// TMDB sirve la oferta de cada país (datos de JustWatch, hay que citarlo:
// `StreamingProviders`) por modalidades: suscripción (`flatrate`), gratis
// (`free`), con anuncios (`ads`), alquiler (`rent`) y compra (`buy`). Antes
// solo se enseñaba una (la primera que hubiera); ahora van todas, cada una
// con su etiqueta.
//
// El anime no viene de TMDB, pero casi todo el anime que se emite en España o
// EE. UU. está en TMDB como serie. Se cruza por el título japonés EXACTO (el
// mismo criterio que los rankings de F-06, `best/localize.ts`): mejor sin
// "Dónde ver" que con la oferta de otra obra.
// ============================================================

import { tmdbWatchLink, type TmdbProvidersResponse } from "@/lib/api/tmdb";
import { searchAnimeTmdb, fromTmdbAnimeRef, isTmdbAnimeId } from "@/lib/api/anime-tmdb";
import type { MediaItem, StreamingProvider } from "@/types/media";

/** Modalidades en el orden en que se pintan. */
export const WATCH_TYPES = ["flatrate", "free", "ads", "rent", "buy"] as const;
export type WatchType = (typeof WATCH_TYPES)[number];

/** Logos a 92 px (se pintan a 48 px): el `original` pesaba 10-30 veces más. */
const LOGO_BASE = "https://image.tmdb.org/t/p/w92";

export interface WatchOffer {
  providers: StreamingProvider[];
  /** Página "dónde ver" de TMDB del país (única forma de enlazar que permite). */
  link?: string;
}

/** Oferta del país pedido, sin repetidos dentro de cada modalidad. */
export function extractWatchOffer(
  resp: TmdbProvidersResponse | undefined | null,
  region: string
): WatchOffer {
  // `free` y `ads` llegan igual que las demás aunque el tipo de `tmdb.ts` no
  // los nombre.
  const country = resp?.results?.[region] as
    | Partial<Record<WatchType, { provider_name?: string; logo_path?: string | null }[]>>
    | undefined;
  if (!country) return { providers: [] };
  const providers: StreamingProvider[] = [];
  for (const type of WATCH_TYPES) {
    const seen = new Set<string>();
    for (const p of country[type] ?? []) {
      if (!p?.provider_name || !p.logo_path || seen.has(p.provider_name)) continue;
      seen.add(p.provider_name);
      providers.push({ name: p.provider_name, logoPath: `${LOGO_BASE}${p.logo_path}`, type });
    }
  }
  return { providers, link: tmdbWatchLink(resp ?? undefined, region) };
}

/** Clave de comparación de títulos japoneses (sin espacios ni puntuación). */
export function titleMatchKey(text: string | undefined | null): string {
  return (text ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\-–—:：・!！?？.,、。'"「」『』()（）]+/g, "");
}

/**
 * Id de TMDB (serie) del mismo anime, o `null`. Un anime servido por TMDB ya
 * lo trae; uno de AniList se busca por sus títulos y solo vale si el título
 * original de TMDB coincide exacto con el japonés de AniList.
 */
export async function findTmdbAnimeId(
  item: MediaItem,
  locale?: string | null
): Promise<number | null> {
  if (isTmdbAnimeId(item.externalId)) return fromTmdbAnimeRef(item.externalId);
  const nativeTitle = item.metadata?.nativeTitle;
  const target = typeof nativeTitle === "string" ? titleMatchKey(nativeTitle) : "";
  if (!target) return null;

  const queries = Array.from(new Set([item.originalTitle, item.title].filter(Boolean))) as string[];
  for (const q of queries) {
    const res = await searchAnimeTmdb(q, 1, locale).catch(() => null);
    const hit = res?.items.find((c) => titleMatchKey(c.originalTitle ?? c.title) === target);
    if (hit && isTmdbAnimeId(hit.externalId)) return fromTmdbAnimeRef(hit.externalId);
  }
  return null;
}
