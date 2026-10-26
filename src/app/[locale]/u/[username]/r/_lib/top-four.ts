// ============================================================
// KULTURA — El "top 4" de la tarjeta OG de /u/{usuario} (F-29). SOLO SERVIDOR.
//
// La tarjeta la ve cualquiera, sin cuenta, y la biblioteca no ("Sin cuenta
// no la ve nadie"). Así que el top 4 sale SOLO de títulos que el dueño ya
// hizo públicos en sus listas, ordenados por lo que él más valora
// (favorito, luego nota). No se pinta ninguna nota, solo el orden; y con la
// biblioteca en "Solo yo" ni eso: las cuatro primeras de sus listas, como
// antes. Lectura con el service role (anon no lee `user_media`), acotada a
// los ids públicos.
// ============================================================

import type { PublicCollectionItem } from "@/lib/social/public-collection";
import { rating10Of } from "./share";

export const TOP_COUNT = 4;
const MAX_IDS = 200;
const NOT_MIGRATED = new Set(["42703", "PGRST204"]);

type Result = PromiseLike<{ data: unknown; error: { code?: string } | null }>;
/** Lo mínimo del cliente admin que se usa (inyectable en tests). */
export interface TopFourClient {
  from(table: string): {
    select(cols: string): {
      eq(col: string, value: string): {
        maybeSingle(): Result;
        in(col: string, values: string[]): { limit(n: number): Result };
      };
    };
  };
}

export interface TopFour {
  posters: string[];
  /** `true` si el orden sale de favoritos/notas (titular "El top 4 de…"). */
  ranked: boolean;
}

interface Row {
  media_id: string;
  favorite?: boolean | null;
  rating10?: number | null;
  score?: number | null;
}

/** Puntuación para ordenar: favorito por delante; luego la nota. `null` sin ninguna de las dos. */
function weight(row: Row): number | null {
  const r = rating10Of(row);
  if (row.favorite) return 100 + (r ?? 0);
  return r;
}

export async function profileTopFour(
  ownerId: string,
  items: PublicCollectionItem[],
  client: TopFourClient | null,
): Promise<TopFour> {
  const seen = new Set<string>();
  const publicItems = items.filter((i) => {
    if (!i.poster || seen.has(i.mediaId)) return false;
    seen.add(i.mediaId);
    return true;
  });
  const fallback: TopFour = { posters: publicItems.slice(0, TOP_COUNT).map((i) => i.poster as string), ranked: false };
  if (!client || publicItems.length === 0) return fallback;

  try {
    const { data: owner, error: ownerErr } = await client
      .from("users")
      .select("library_visibility")
      .eq("id", ownerId)
      .maybeSingle();
    const visibility =
      ownerErr && NOT_MIGRATED.has(ownerErr.code ?? "")
        ? "friends"
        : (owner as { library_visibility?: string } | null)?.library_visibility;
    if (ownerErr && !NOT_MIGRATED.has(ownerErr.code ?? "")) return fallback;
    if (visibility === "private") return fallback;

    const ids = publicItems.slice(0, MAX_IDS).map((i) => i.mediaId);
    const read = (cols: string) =>
      client.from("user_media").select(cols).eq("user_id", ownerId).in("media_id", ids).limit(MAX_IDS);
    let { data, error } = await read("media_id, favorite, rating10, score");
    if (error && NOT_MIGRATED.has(error.code ?? "")) ({ data, error } = await read("media_id, score"));
    if (error || !Array.isArray(data)) return fallback;

    const weights = new Map<string, number>();
    for (const row of data as Row[]) {
      const w = weight(row);
      if (w !== null) weights.set(row.media_id, w);
    }
    if (weights.size === 0) return fallback;
    const order = new Map(publicItems.map((i, idx) => [i.mediaId, idx]));
    const ranked = publicItems
      .filter((i) => weights.has(i.mediaId))
      .sort((a, b) => weights.get(b.mediaId)! - weights.get(a.mediaId)! || order.get(a.mediaId)! - order.get(b.mediaId)!);
    const rest = publicItems.filter((i) => !weights.has(i.mediaId));
    return { posters: [...ranked, ...rest].slice(0, TOP_COUNT).map((i) => i.poster as string), ranked: true };
  } catch {
    return fallback;
  }
}
