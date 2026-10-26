// ============================================================
// KULTURA — Adaptaciones de un título: Wikidata + caché (F-29). SOLO SERVIDOR.
//
// Orden:
//   1. Caché en tabla `media_adaptations` (migración 20261215290001), solo con
//      ADAPTATIONS_CACHE=1 y siempre con el service role (la tabla no tiene
//      políticas: ni anon ni authenticated la leen). 30 días si había algo;
//      7 si Wikidata no conocía el título (para no preguntar en cada visita).
//   2. Wikidata (una consulta, tope 4 s). Si falla: lo último guardado aunque
//      haya caducado, o nada (la ficha se pinta sin la sección).
//   3. Los dos casos que necesitan un paso más: juego (slug de RAWG → id) y
//      libro con solo una edición (`OL…M` → su obra `OL…W`). Máximo
//      `MAX_PENDING` por título, en paralelo, cada uno con su tope.
//   4. Se guarda (si falla la escritura, da igual: se devuelve igualmente).
// Delante va la caché de datos de Next (24 h): sin la tabla aplicada, una
// ficha muy visitada pregunta a Wikidata una vez al día, no en cada visita.
// Antes de la migración (42P01) todo funciona igual, sin el paso 1 ni el 4.
// ============================================================

import { unstable_cache } from "next/cache";
import { fetchAdaptations, wikidataKeyFor, type WikidataAdaptations } from "@/lib/api/wikidata";
import { getGame } from "@/lib/api/rawg";
import { createLogger } from "@/lib/logger";
import {
  isStoredAdaptations,
  pendingRefs,
  toStored,
  type PendingRef,
  type StoredAdaptations,
} from "./model";

const log = createLogger("adaptations");

export const ADAPTATIONS_TABLE = "media_adaptations";
const DAY_MS = 86_400_000;
export const FRESH_DAYS = 30;
export const EMPTY_FRESH_DAYS = 7;
const MAX_PENDING = 8;
const PENDING_TIMEOUT_MS = 2500;
const NOT_MIGRATED = new Set(["42P01", "42703", "PGRST204", "PGRST205"]);

/** La tabla de caché se usa solo tras aplicar la migración y activar la bandera. */
export function adaptationsCacheEnabled(): boolean {
  return process.env.ADAPTATIONS_CACHE === "1";
}

interface CacheRow {
  media_id: string;
  wikidata_id: string | null;
  payload: unknown;
  fetched_at: string;
}

/** Lo mínimo del cliente de Supabase que usa la caché (inyectable en tests). */
export interface CacheClient {
  from(table: string): {
    select(cols: string): {
      eq(col: string, value: string): {
        maybeSingle(): PromiseLike<{ data: unknown; error: { code?: string | null; message?: string } | null }>;
      };
    };
    upsert(
      row: CacheRow,
      opts: { onConflict: string },
    ): PromiseLike<{ error: { code?: string | null; message?: string } | null }>;
  };
}

export interface LoadDeps {
  /** Cliente con service role. Sin él (o sin bandera) no hay caché en tabla. */
  cache?: CacheClient | null;
  fetchImpl?: typeof fetch;
  /** Slug de RAWG → id numérico. Por defecto, la ficha de RAWG. */
  resolveRawg?: (slug: string) => Promise<string | null>;
  now?: () => number;
}

function isFresh(row: CacheRow, payload: StoredAdaptations, now: number): boolean {
  const age = now - Date.parse(row.fetched_at);
  const days = payload.works.length > 0 || payload.franchise ? FRESH_DAYS : EMPTY_FRESH_DAYS;
  return Number.isFinite(age) && age >= 0 && age < days * DAY_MS;
}

async function readCache(client: CacheClient, mediaId: string): Promise<{ row: CacheRow; payload: StoredAdaptations } | null> {
  try {
    const { data, error } = await client
      .from("media_adaptations")
      .select("media_id, wikidata_id, payload, fetched_at")
      .eq("media_id", mediaId)
      .maybeSingle();
    if (error) {
      if (!NOT_MIGRATED.has(error.code ?? "")) log.warn("No se pudo leer la caché de adaptaciones", { code: error.code });
      return null;
    }
    const row = data as CacheRow | null;
    return row && isStoredAdaptations(row.payload) ? { row, payload: row.payload } : null;
  } catch {
    return null;
  }
}

async function writeCache(client: CacheClient, mediaId: string, payload: StoredAdaptations, now: number) {
  try {
    const { error } = await client.from("media_adaptations").upsert(
      { media_id: mediaId, wikidata_id: payload.qid, payload, fetched_at: new Date(now).toISOString() },
      { onConflict: "media_id" },
    );
    if (error && !NOT_MIGRATED.has(error.code ?? "")) {
      log.warn("No se pudo guardar la caché de adaptaciones", { code: error.code });
    }
  } catch {
    // La caché es una ayuda: sin ella la ficha sigue.
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

/** RAWG acepta id o slug en `/games/{id}`; `getGame` solo tipa el número. */
async function rawgIdFromSlug(slug: string): Promise<string | null> {
  const game = await getGame(slug as unknown as number);
  return typeof game?.id === "number" ? String(game.id) : null;
}

/** Edición de Open Library (`OL…M`) → su obra (`OL…W`), que es lo que abre la ficha. */
export async function openLibraryWorkOf(edition: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  if (!/^OL\d{1,12}M$/.test(edition)) return null;
  const res = await fetchImpl(`https://openlibrary.org/books/${edition}.json`, {
    headers: { Accept: "application/json", "User-Agent": "KulturaBot/1.0 (https://github.com/benevi/kultura)" },
    signal: AbortSignal.timeout(PENDING_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { works?: Array<{ key?: unknown }> };
  const key = json.works?.[0]?.key;
  const work = typeof key === "string" ? /^\/works\/(OL\d{1,12}W)$/.exec(key)?.[1] : null;
  return work ?? null;
}

/** Pendientes → ids de KULTURA (lo que no se resuelve a tiempo, fuera). */
export async function resolvePending(
  pending: PendingRef[],
  deps: Pick<LoadDeps, "fetchImpl" | "resolveRawg"> = {},
): Promise<Map<string, string>> {
  const rawg = deps.resolveRawg ?? rawgIdFromSlug;
  const out = new Map<string, string>();
  await Promise.allSettled(
    pending.slice(0, MAX_PENDING).map(async (p) => {
      const id =
        p.kind === "rawg"
          ? await withTimeout(rawg(p.value), PENDING_TIMEOUT_MS)
          : await withTimeout(openLibraryWorkOf(p.value, deps.fetchImpl), PENDING_TIMEOUT_MS);
      if (id) out.set(p.key, p.kind === "rawg" ? `game_${id}` : `book_${id}`);
    }),
  );
  return out;
}

/**
 * Adaptaciones de `mediaId` en el formato de la caché, o `null` si Wikidata
 * no se puede consultar para ese título (forma de id sin equivalente) o no
 * responde y no hay nada guardado. Nunca lanza.
 */
export async function loadAdaptationsUncached(
  mediaId: string,
  hints: { rawgSlug?: string } = {},
  deps: LoadDeps = {},
): Promise<StoredAdaptations | null> {
  const key = wikidataKeyFor(mediaId, hints);
  if (!key) return null;
  const now = (deps.now ?? Date.now)();
  const cache = deps.cache ?? null;

  const cached = cache ? await readCache(cache, mediaId) : null;
  if (cached && isFresh(cached.row, cached.payload, now)) return cached.payload;

  let parsed: WikidataAdaptations;
  try {
    parsed = await fetchAdaptations(key, { fetchImpl: deps.fetchImpl });
  } catch (err) {
    log.warn("Wikidata no respondió; se usa la caché si la hay", {
      mediaId,
      err: err instanceof Error ? err.message : String(err),
    });
    return cached?.payload ?? null;
  }

  const resolved = await resolvePending(pendingRefs(parsed), deps);
  const stored = toStored(parsed, mediaId, resolved);
  if (cache) await writeCache(cache, mediaId, stored, now);
  return stored;
}

/** Cliente con service role, solo si la bandera está puesta (y la clave existe). */
async function defaultCacheClient(): Promise<CacheClient | null> {
  if (!adaptationsCacheEnabled()) return null;
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    return createAdminClient() as unknown as CacheClient;
  } catch {
    return null;
  }
}

const CACHE_VERSION = "adaptations-v1";
export const ADAPTATIONS_CACHE_TAG = "adaptations";

const cachedLoad = unstable_cache(
  async (mediaId: string, rawgSlug: string) =>
    loadAdaptationsUncached(mediaId, { rawgSlug: rawgSlug || undefined }, { cache: await defaultCacheClient() }),
  [CACHE_VERSION],
  { revalidate: DAY_MS / 1000, tags: [ADAPTATIONS_CACHE_TAG] },
);

/** Lo que usa la ficha: caché de datos de Next delante de `loadAdaptationsUncached`. Nunca lanza. */
export async function getAdaptations(mediaId: string, hints: { rawgSlug?: string } = {}): Promise<StoredAdaptations | null> {
  try {
    return await cachedLoad(mediaId, hints.rawgSlug ?? "");
  } catch (err) {
    // Fuera de Next (tests, scripts) no hay caché de datos: directo.
    if (err instanceof Error && err.message.includes("incrementalCache missing")) {
      return loadAdaptationsUncached(mediaId, hints, { cache: await defaultCacheClient() });
    }
    return null;
  }
}
