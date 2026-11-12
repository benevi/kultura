// ============================================================
// KULTURA — Top 4 del perfil en su tarjeta OG (CRE-8c, F-29). SOLO SERVIDOR.
//
// Los 4 favoritos son de la BIBLIOTECA (los mismos que pinta el perfil con
// `pickFavorites`), y la tarjeta OG la ve cualquiera sin cuenta. Misma regla
// que la nota sin firma (`anonymousCanSeeLibrary`): solo con
// `SHARE_PUBLIC_LIBRARY=1` y biblioteca "pública". Apagado, `null`, y la
// tarjeta sigue con las portadas de las listas públicas.
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { pickFavorites, type FavoriteItem } from "@/lib/social/public-collection";
import { anonymousCanSeeLibrary, findShareOwner } from "@/lib/share/rating-share";
import { rating10ToScore, storedRating10 } from "@/lib/library/rating";

const CANDIDATES = 40;

type Row = {
  media_id: string;
  rating10: number | string | null;
  media: { title?: string | null; poster?: string | null; type?: string | null; year?: number | null } | null;
};

export async function publicTopFour(username: string): Promise<FavoriteItem[] | null> {
  const owner = await findShareOwner(username).catch(() => null);
  if (!owner || !anonymousCanSeeLibrary(owner.libraryVisibility)) return null;
  try {
    const { data, error } = await createAdminClient()
      .from("user_media")
      .select("media_id, rating10, media(title, poster, type, year)")
      .eq("user_id", owner.id)
      .not("rating10", "is", null)
      .order("rating10", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(CANDIDATES);
    if (error) return null;
    const candidates = ((data ?? []) as unknown as Row[])
      .map((r) => ({ r, score: rating10ToScore(storedRating10(r.rating10)) }))
      .filter(({ r, score }) => score !== null && r.media?.title)
      .map(({ r, score }) => ({
        mediaId: r.media_id,
        title: r.media!.title!,
        poster: r.media!.poster ?? null,
        type: r.media!.type ?? r.media_id.split("_")[0],
        year: r.media!.year ?? undefined,
        score: score as number,
      }));
    const top = pickFavorites(candidates);
    return top.length > 0 ? top : null;
  } catch {
    return null;
  }
}
