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
import { anonymousCanSeeLibrary, findShareOwner } from "./rating-share";

const CANDIDATES = 40;

type Row = {
  media_id: string;
  score: number | null;
  media: { title?: string | null; poster?: string | null; type?: string | null; year?: number | null } | null;
};

export async function publicTopFour(username: string): Promise<FavoriteItem[] | null> {
  const owner = await findShareOwner(username).catch(() => null);
  if (!owner || !anonymousCanSeeLibrary(owner.libraryVisibility)) return null;
  try {
    const { data, error } = await createAdminClient()
      .from("user_media")
      .select("media_id, score, media(title, poster, type, year)")
      .eq("user_id", owner.id)
      .not("score", "is", null)
      .order("score", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(CANDIDATES);
    if (error) return null;
    const candidates = ((data ?? []) as unknown as Row[])
      .filter((r) => typeof r.score === "number" && r.media?.title)
      .map((r) => ({
        mediaId: r.media_id,
        title: r.media!.title!,
        poster: r.media!.poster ?? null,
        type: r.media!.type ?? r.media_id.split("_")[0],
        year: r.media!.year ?? undefined,
        score: r.score as number,
      }));
    const top = pickFavorites(candidates);
    return top.length > 0 ? top : null;
  } catch {
    return null;
  }
}
