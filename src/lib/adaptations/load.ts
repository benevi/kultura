// ============================================================
// KULTURA — Adaptaciones de un título (F-29, PRO-11)
//
//   ficha → getAdaptations(item)
//     1. ¿Cómo se llama este título en Wikidata? (`subjectClaim`; para juegos y
//        MangaDex hace falta su slug / sus enlaces, que salen de la misma
//        ficha del proveedor ya cacheada).
//     2. Tabla `media_adaptations`: fila vigente → se sirve tal cual.
//     3. Si no, una consulta SPARQL (plazo de 8 s y circuito de `http.ts`),
//        los juegos se pasan de slug a número de RAWG (como mucho 4, y nunca
//        con el cupo de RAWG al 80 %) y se guarda con su TTL.
//     4. Wikidata caído o lento: la fila caducada si la hay; si no, nada (y
//        no se guarda nada: el siguiente lo vuelve a intentar).
//   Sin la tabla (migración pendiente) la respuesta de Wikidata va a la caché
//   de datos de Next con la misma TTL.
//
// Nunca lanza: la sección de la ficha es un extra y no puede tumbarla.
// ============================================================

import * as React from "react";
import type { MediaItem } from "@/types/media";
import { env } from "@/lib/env.server";
import { ProviderError, isProviderQuotaHot, providerFetch } from "@/lib/api/http";
import { rawgDetailSchema } from "@/lib/api/schemas/rawg";
import { getGame } from "@/lib/api/rawg";
import { getManga as getMangaDex, isMangaDexId } from "@/lib/api/mangadex";
import {
  buildAdaptationsQuery,
  runSparql,
  subjectClaims,
  type ClaimHints,
  type WikidataClaim,
} from "@/lib/api/wikidata";
import { createLogger } from "@/lib/logger";
import { mapAdaptations, subjectQid, type AdaptationLink } from "./map";
import {
  readStoredAdaptations,
  writeStoredAdaptations,
  type AdaptationStatus,
  type StoredAdaptations,
} from "./store";

const log = createLogger("adaptations");

const DAY = 86_400;

/** TTL de cada resultado (segundos). */
export const ADAPTATIONS_TTL: Record<AdaptationStatus | "empty", number> = {
  /** Con vínculos: Wikidata cambia poco. */
  ok: 30 * DAY,
  /** El título está en Wikidata pero sin obras relacionadas abribles. */
  empty: 7 * DAY,
  /** Wikidata no conoce el título (o no tiene nada relacionado). */
  not_found: 7 * DAY,
  /** Faltó resolver algo (un juego en RAWG): se reintenta pronto. */
  partial: DAY,
};

/** Vínculos guardados por título como mucho (la franquicia entera de Star Wars no cabe en una ficha). */
export const MAX_STORED_LINKS = 40;
/** Juegos que se resuelven de slug a número por consulta (cupo de RAWG, 20.000/mes). */
export const MAX_GAME_LOOKUPS = 4;

export interface AdaptationsResult {
  links: AdaptationLink[];
  /** De dónde salió (para logs y tests). */
  source: "table" | "stale" | "wikidata" | "none";
}

const NONE: AdaptationsResult = { links: [], source: "none" };

// ── Pistas del proveedor ──────────────────────────────────────────────────────

/** Slug de RAWG y enlaces de MangaDex, de la ficha del proveedor (misma URL que la ficha: caché). */
export async function claimHints(item: Pick<MediaItem, "type" | "externalId">): Promise<ClaimHints> {
  try {
    if (item.type === "game" && /^\d{1,10}$/.test(item.externalId)) {
      const game = (await getGame(Number(item.externalId))) as { slug?: unknown };
      return typeof game.slug === "string" ? { rawgSlug: game.slug } : {};
    }
    if (item.type === "manga" && isMangaDexId(item.externalId)) {
      const detail = await getMangaDex(item.externalId);
      const links = (detail.data.attributes as { links?: unknown }).links;
      return links && typeof links === "object" ? { mangaDexLinks: links as Record<string, unknown> } : {};
    }
  } catch {
    // Sin pista no hay consulta: la ficha sale sin la sección.
  }
  return {};
}

// ── Juegos: slug de Wikidata → número de RAWG ─────────────────────────────────

/** Número de RAWG de un slug, `null` si no existe; lanza si RAWG no responde. */
export async function resolveRawgSlug(slug: string): Promise<number | null> {
  const url = new URL(`https://api.rawg.io/api/games/${encodeURIComponent(slug)}`);
  url.searchParams.set("key", env.RAWG_API_KEY);
  try {
    const game = await providerFetch<{ id?: unknown }>("rawg", url.toString(), {
      schema: rawgDetailSchema,
      label: "/games/{slug}",
      // Un slug no cambia de número: 30 días en la caché de datos.
      cache: { revalidate: 30 * DAY },
    });
    return typeof game.id === "number" && Number.isInteger(game.id) && game.id > 0 ? game.id : null;
  } catch (e) {
    if (e instanceof ProviderError && e.status === 404) return null;
    throw e;
  }
}

async function resolveGames(links: AdaptationLink[]): Promise<{ links: AdaptationLink[]; partial: boolean }> {
  const pending = links.filter((l) => l.type === "game" && !l.mediaId && l.rawgSlug);
  if (pending.length === 0) return { links, partial: false };
  // ROJO-9: con el cupo de RAWG caliente no se gasta en esto.
  const hot = isProviderQuotaHot("rawg");
  const chosen = hot ? [] : pending.slice(0, MAX_GAME_LOOKUPS);
  let partial = hot;
  const resolved = new Map<string, number>();
  await Promise.all(
    chosen.map(async (link) => {
      try {
        const id = await resolveRawgSlug(link.rawgSlug!);
        if (id) resolved.set(link.rawgSlug!, id);
      } catch {
        partial = true;
      }
    })
  );
  const out: AdaptationLink[] = [];
  const seen = new Set(links.map((l) => l.mediaId).filter(Boolean));
  for (const link of links) {
    if (link.type !== "game" || link.mediaId) {
      out.push(link);
      continue;
    }
    const id = link.rawgSlug ? resolved.get(link.rawgSlug) : undefined;
    if (!id) continue;
    const mediaId = `game_${id}`;
    if (seen.has(mediaId)) continue;
    seen.add(mediaId);
    out.push({ ...link, mediaId, externalId: String(id) });
  }
  return { links: out, partial };
}

// ── Consulta ──────────────────────────────────────────────────────────────────

export async function fetchAdaptations(
  subjectMediaId: string,
  claim: WikidataClaim | WikidataClaim[],
  cache: false | { revalidate: number }
): Promise<Omit<StoredAdaptations, "fetchedAt" | "expiresAt">> {
  const { results } = await runSparql(buildAdaptationsQuery(claim), { cache });
  const bindings = results.bindings;
  const mapped = mapAdaptations(bindings, subjectMediaId);
  const { links, partial } = await resolveGames(mapped);
  const kept = links.filter((l) => l.mediaId).slice(0, MAX_STORED_LINKS);
  const status: AdaptationStatus = partial ? "partial" : bindings.length === 0 ? "not_found" : "ok";
  return { subjectQid: subjectQid(bindings), links: kept, status };
}

function ttlFor(value: Pick<StoredAdaptations, "status" | "links">): number {
  if (value.status === "ok" && value.links.length === 0) return ADAPTATIONS_TTL.empty;
  return ADAPTATIONS_TTL[value.status];
}

type Subject = Pick<MediaItem, "id" | "type" | "externalId"> & { malId?: unknown };

async function loadUncached(item: Subject): Promise<AdaptationsResult> {
  const claim = subjectClaims(item.type, item.externalId, { ...(await claimHints(item)), malId: item.malId });
  if (claim.length === 0) return NONE;

  const stored = await readStoredAdaptations(item.id);
  if (stored.kind === "hit" && stored.fresh) return { links: stored.row.links, source: "table" };

  const tableMissing = stored.kind === "missing";
  try {
    // Sin tabla, la caché de datos de Next hace de tabla (misma TTL que "ok").
    const value = await fetchAdaptations(item.id, claim, tableMissing ? { revalidate: ADAPTATIONS_TTL.ok } : false);
    if (!tableMissing) await writeStoredAdaptations(item.id, value, ttlFor(value));
    return { links: value.links, source: "wikidata" };
  } catch (e) {
    if (!(e instanceof ProviderError)) log.warn("no se pudieron cargar las adaptaciones", { id: item.id, err: e });
    if (stored.kind === "hit") return { links: stored.row.links, source: "stale" };
    return NONE;
  }
}

// `React.cache` (una carga por petición) existe en el React de servidor de Next.
const dedupe: <T extends (...args: never[]) => unknown>(fn: T) => T =
  (React as unknown as { cache?: <T>(fn: T) => T }).cache ?? ((fn) => fn);

const loadByKey = dedupe(async (id: string, type: MediaItem["type"], externalId: string, malId: unknown) =>
  loadUncached({ id, type, externalId, malId }).catch(() => NONE)
);

/** Adaptaciones del título (vacío si no hay o no se pudieron cargar). Nunca lanza. */
export function getAdaptations(item: Pick<MediaItem, "id" | "type" | "externalId" | "metadata">): Promise<AdaptationsResult> {
  // AniList da el id de MyAnimeList (manga): segunda vía en Wikidata.
  const malId = item.metadata?.malId;
  return loadByKey(item.id, item.type, item.externalId, typeof malId === "number" ? malId : undefined);
}
