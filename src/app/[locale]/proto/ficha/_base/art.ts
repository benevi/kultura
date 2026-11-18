// Prototipo fase 8.3 — arte apaisado SIN rótulo para la sala de la dirección A
// (el título lo ponemos nosotros). Solo lo que el proveedor da, por las rutas
// de siempre (directa al CDN, con CORS; nada nuevo por el optimizador):
//   · película / serie: imagen de fondo de TMDB. Se piden a `/images` las que
//     no tienen idioma (`iso_639_1: null` = sin texto) y, si no hay, vale la
//     `backdrop` que ya trae la ficha.
//   · videojuego: `background_image` de RAWG (es ya la «portada» del juego).
//   · anime: `bannerImage` de AniList (el cargador de la app no lo pide: se
//     consulta aquí, solo en el prototipo).
//   · libro, manga y cómic: no hay arte sin rótulo → `null` (la sala enseña la
//     portada entera como pieza).
// [P] Dos peticiones que la app no hace hoy (TMDB `/images` y `bannerImage`):
// si la dirección sigue adelante, pasan al cargador real y por revisión legal.

import { env } from "@/lib/env.server";
import type { MediaItem } from "@/types/media";
import { coverSource } from "./cover";
import type { CoverSource } from "./types";

const DAY = 60 * 60 * 24;
const TMDB_FILE = /^\/[\w-]+\.(?:jpg|png|webp)$/;

function tmdbArt(file: string): CoverSource {
  const at = (size: string) => `https://image.tmdb.org/t/p/${size}${file}`;
  return {
    original: at("original"),
    src: at("w1280"),
    srcSet: `${at("w780")} 780w, ${at("w1280")} 1280w`,
    small: at("w300"),
    canvasSafe: true,
    sample: at("w300"),
    shape: "landscape",
  };
}

async function tmdbTextless(kind: "movie" | "tv", id: string): Promise<string | undefined> {
  if (!/^\d+$/.test(id)) return undefined;
  try {
    const url = new URL(`https://api.themoviedb.org/3/${kind}/${id}/images`);
    url.searchParams.set("api_key", env.TMDB_API_KEY);
    url.searchParams.set("include_image_language", "null");
    const res = await fetch(url, { next: { revalidate: DAY } });
    if (!res.ok) return undefined;
    const json = (await res.json()) as {
      backdrops?: { file_path?: unknown; iso_639_1?: unknown; vote_average?: unknown; aspect_ratio?: unknown }[];
    };
    const best = (json.backdrops ?? [])
      .filter((b) => b.iso_639_1 == null && typeof b.file_path === "string" && TMDB_FILE.test(b.file_path))
      .filter((b) => typeof b.aspect_ratio !== "number" || b.aspect_ratio > 1.5)
      .sort((a, b) => (Number(b.vote_average) || 0) - (Number(a.vote_average) || 0))[0];
    return best ? (best.file_path as string) : undefined;
  } catch {
    return undefined;
  }
}

async function anilistBanner(externalId: string): Promise<string | undefined> {
  const m = /^al-(\d+)$/.exec(externalId);
  if (!m) return undefined;
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: "query($id:Int){Media(id:$id,type:ANIME){bannerImage}}", variables: { id: Number(m[1]) } }),
      next: { revalidate: DAY },
    });
    if (!res.ok) return undefined;
    const json = (await res.json()) as { data?: { Media?: { bannerImage?: unknown } } };
    const url = json.data?.Media?.bannerImage;
    return typeof url === "string" && /^https:\/\/s4\.anilist\.co\//.test(url) ? url : undefined;
  } catch {
    return undefined;
  }
}

/** Arte apaisado sin rótulo de la obra, o `null` si el proveedor no lo da. */
export async function wideArt(item: MediaItem): Promise<CoverSource | null> {
  if (item.type === "movie" || item.type === "tv") {
    const file = (await tmdbTextless(item.type, item.externalId)) ?? item.backdrop?.match(/(\/[\w-]+\.(?:jpg|png|webp))$/)?.[1];
    return file ? tmdbArt(file) : null;
  }
  if (item.type === "game") return coverSource(item.poster, "game");
  if (item.type === "anime") {
    const url = await anilistBanner(item.externalId);
    return url
      ? { original: url, src: url, srcSet: `${url} 1900w`, small: url, canvasSafe: true, sample: url, shape: "landscape" }
      : null;
  }
  return null;
}
