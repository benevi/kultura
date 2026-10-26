// ============================================================
// KULTURA — Tarjetas de "También existe como…" (F-29). SOLO SERVIDOR.
//
// De los vínculos guardados a lo que pinta la ficha: título en el idioma de la
// página (etiqueta de Wikidata; si no, la del catálogo), portada (tabla
// `media` y, para las que falten, la ficha del proveedor ya cacheada 24 h, con
// tope de tiempo) y si ya está en la biblioteca de quien mira.
//
// Ninguna portada es obligatoria: la tarjeta lleva SIEMPRE el gradiente detrás
// (E-CARD-PORTADA-404) y no es una card de catálogo (`requirePoster`).
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaType } from "@/types/media";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadMediaDetail } from "@/lib/media/detail-data";
import { isProviderQuotaHot } from "@/lib/api/http";
import { linkTitle, type AdaptationLink, type AdaptationRelation } from "./map";

/** Tarjetas que enseña la ficha. */
export const DISPLAY_LIMIT = 12;
/** Títulos que "Añadir toda la franquicia" añade de una vez (límite de /api/library: 30/min). */
export const FRANCHISE_ADD_LIMIT = 24;
/** Portadas que se piden al proveedor por ficha si no están en `media`. */
const POSTER_LOOKUPS = 6;
const POSTER_LOOKUP_TIMEOUT_MS = 2500;

export interface AdaptationCard {
  mediaId: string;
  type: MediaType;
  externalId: string;
  title: string;
  year?: number;
  poster?: string;
  relation: AdaptationRelation;
  inLibrary: boolean;
}

export interface AdaptationView {
  cards: AdaptationCard[];
  /** Lo que añadiría "Añadir toda la franquicia" (no está en la biblioteca). */
  addable: { mediaId: string; title: string }[];
}

type MediaRow = { id: string; title: string | null; poster: string | null; year: number | null };

async function catalogRows(ids: string[]): Promise<Map<string, MediaRow>> {
  if (ids.length === 0) return new Map();
  try {
    const { data } = await createAdminClient().from("media").select("id, title, poster, year").in("id", ids);
    return new Map(((data ?? []) as MediaRow[]).map((r) => [r.id, r]));
  } catch {
    return new Map();
  }
}

/** Ids de `ids` que ya están en la biblioteca del usuario (con SU sesión: RLS). */
async function libraryIds(supabase: SupabaseClient | null, userId: string | null, ids: string[]): Promise<Set<string>> {
  if (!supabase || !userId || ids.length === 0) return new Set();
  try {
    const { data, error } = await supabase.from("user_media").select("media_id").eq("user_id", userId).in("media_id", ids);
    if (error) return new Set();
    return new Set(((data ?? []) as { media_id: string }[]).map((r) => r.media_id));
  } catch {
    return new Set();
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      }
    );
  });
}

/** Portada y título del proveedor para las que no están en el catálogo (con tope de tiempo). */
async function providerPosters(
  links: AdaptationLink[],
  locale: string
): Promise<Map<string, { poster?: string; title?: string; year?: number }>> {
  const out = new Map<string, { poster?: string; title?: string; year?: number }>();
  const targets = links
    // ROJO-9: un juego gasta cupo de RAWG; con el cupo caliente, sin portada.
    .filter((l) => !(l.type === "game" && isProviderQuotaHot("rawg")))
    .slice(0, POSTER_LOOKUPS);
  await Promise.all(
    targets.map(async (link) => {
      const detail = await withTimeout(loadMediaDetail(link.type, link.externalId, locale), POSTER_LOOKUP_TIMEOUT_MS);
      if (detail?.item) out.set(link.mediaId!, { poster: detail.item.poster, title: detail.item.title, year: detail.item.year });
    })
  );
  return out;
}

export async function buildAdaptationView(
  links: AdaptationLink[],
  opts: { locale: string; userId: string | null; supabase: SupabaseClient | null }
): Promise<AdaptationView> {
  const usable = links.filter((l): l is AdaptationLink & { mediaId: string } => Boolean(l.mediaId && l.externalId));
  if (usable.length === 0) return { cards: [], addable: [] };

  const shown = usable.slice(0, DISPLAY_LIMIT);
  const ids = usable.map((l) => l.mediaId);
  const [rows, owned] = await Promise.all([
    catalogRows(shown.map((l) => l.mediaId)),
    libraryIds(opts.supabase, opts.userId, ids),
  ]);
  const missing = shown.filter((l) => !rows.get(l.mediaId)?.poster);
  const fetched = await providerPosters(missing, opts.locale);

  const titleOf = (link: AdaptationLink & { mediaId: string }) =>
    linkTitle(link, opts.locale) || rows.get(link.mediaId)?.title || fetched.get(link.mediaId)?.title || "";

  const cards: AdaptationCard[] = shown
    .map((link) => {
      const row = rows.get(link.mediaId);
      const extra = fetched.get(link.mediaId);
      return {
        mediaId: link.mediaId,
        type: link.type,
        externalId: link.externalId,
        title: titleOf(link),
        year: link.year ?? row?.year ?? extra?.year ?? undefined,
        poster: row?.poster ?? extra?.poster ?? undefined,
        relation: link.relations[0],
        inLibrary: owned.has(link.mediaId),
      };
    })
    .filter((c) => c.title);

  const addable = usable
    .filter((l) => !owned.has(l.mediaId))
    .slice(0, FRANCHISE_ADD_LIMIT)
    .map((l) => ({ mediaId: l.mediaId, title: titleOf(l) }))
    .filter((a) => a.title);

  return { cards, addable };
}
