// Prototipo fase 8.3 — arte apaisado SIN rótulo para la sala de la dirección A
// (el título lo ponemos nosotros). Solo lo que el proveedor da, por las rutas
// de siempre (directa al CDN, con CORS; nada nuevo por el optimizador):
//   · película / serie: imagen de fondo de TMDB. Se piden a `/images` las que
//     no tienen idioma (`iso_639_1: null` = sin texto) y, si no hay, vale la
//     `backdrop` que ya trae la ficha.
//   · videojuego: `background_image` de RAWG (es ya la «portada» del juego).
//   · anime: el banner de AniList (1900 × 400) no da para llenar la sala sin
//     ampliarlo ×2: ya no se pide. Se busca la obra en TMDB y se usa su imagen
//     de fondo sin texto; si no hay coincidencia segura, Pieza.
//   · libro, manga y cómic: no hay arte sin rótulo → `null` (la sala enseña
//     la portada entera como pieza, a su tamaño).
// [P] Una petición que la app no hace hoy (TMDB `/images`): si la dirección
// sigue adelante, pasa al cargador real y por revisión legal.

import { env } from "@/lib/env.server";
import type { MediaItem } from "@/types/media";
import type { CoverSource } from "./types";

const DAY = 60 * 60 * 24;
const TMDB_FILE = /^\/[\w-]+\.(?:jpg|png|webp)$/;

/**
 * Regla de calidad (Víctor, 18-11-2026): una imagen nunca se amplía más de
 * ~1,25× su tamaño natural. La sala llega a 1600 × 900 px CSS antes de que el
 * CSS la limite (`--a-max-w/h`), así que para ser sala hace falta al menos
 * 1280 × 720. Si no llega, la obra va en modo Pieza.
 */
const MIN_W = 1280, MIN_H = 720;

interface Backdrop { file: string; w: number; h: number }

function tmdbArt({ file, w, h }: Backdrop): CoverSource {
  const at = (size: string) => `https://image.tmdb.org/t/p/${size}${file}`;
  // Primero un tamaño razonable (w780 / w1280: 60–150 KB); el original (`hi`, 0,5 MB o más)
  // lo pide Stage después, cuando la página ya está y solo si la pantalla lo necesita.
  return {
    original: at("original"),
    src: at("w1280"),
    srcSet: `${at("w780")} 780w, ${at("w1280")} 1280w`,
    small: at("w300"),
    canvasSafe: true,
    sample: at("w300"),
    shape: "landscape",
    hi: w > 1280 ? at("original") : at("w1280"),
    natural: { w: Math.max(w, 1280), h: Math.max(h, 720) },
  };
}

/** Imágenes de fondo SIN texto de TMDB (`iso_639_1: null`), de más a menos votada. */
async function tmdbTextless(kind: "movie" | "tv", id: string): Promise<Backdrop[]> {
  if (!/^\d+$/.test(id)) return [];
  try {
    const url = new URL(`https://api.themoviedb.org/3/${kind}/${id}/images`);
    url.searchParams.set("api_key", env.TMDB_API_KEY);
    url.searchParams.set("include_image_language", "null");
    const res = await fetch(url, { next: { revalidate: DAY } });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      backdrops?: { file_path?: unknown; iso_639_1?: unknown; vote_average?: unknown; aspect_ratio?: unknown; width?: unknown; height?: unknown }[];
    };
    return (json.backdrops ?? [])
      .filter((b) => b.iso_639_1 == null && typeof b.file_path === "string" && TMDB_FILE.test(b.file_path))
      .filter((b) => typeof b.aspect_ratio !== "number" || b.aspect_ratio > 1.5)
      .filter((b) => Number(b.width) >= MIN_W && Number(b.height) >= MIN_H)
      .sort((a, b) => (Number(b.vote_average) || 0) - (Number(a.vote_average) || 0))
      .map((b) => ({ file: b.file_path as string, w: Number(b.width), h: Number(b.height) }));
  } catch {
    return [];
  }
}

/** Arte de RAWG: `resize/640`, `resize/1280` y el original (suele ser ≥ 1920 px; RAWG no dice su tamaño). */
function rawgArt(poster: string | undefined): CoverSource | null {
  const m = poster?.match(/^https:\/\/media\.rawg\.io\/media\/(?:resize\/\d+\/-\/|crop\/\d+\/\d+\/)?(.+)$/);
  if (!m) return null;
  const at = (w: number) => `https://media.rawg.io/media/resize/${w}/-/${m[1]}`;
  const original = `https://media.rawg.io/media/${m[1]}`;
  return {
    original,
    src: at(1280),
    srcSet: `${at(640)} 640w, ${at(1280)} 1280w`,
    small: at(420),
    canvasSafe: true,
    sample: at(420),
    shape: "landscape",
    hi: original,
    natural: { w: 1920, h: 1080 },
  };
}

const norm = (s: string) => s.normalize("NFKC").replace(/[\s\u3000・:：!！?？~〜\-–—]/g, "").toLowerCase();

/**
 * Anime → TMDB (API oficial, ya la usa la app). APAÑO DE PROTOTIPO: se busca
 * por el título en japonés y solo vale una coincidencia EXACTA de título
 * original con el mismo año (±1). Sin coincidencia segura no hay sala: Pieza.
 * En producción el cruce sale de Wikidata (la app ya lo consulta para las
 * adaptaciones): propiedad P8729 (id de AniList) → P4947 (película en TMDB) o
 * P4983 (serie en TMDB), guardado con la obra; esta búsqueda queda de respaldo.
 */
async function tmdbForAnime(item: MediaItem): Promise<{ kind: "movie" | "tv"; id: string } | null> {
  const native = item.metadata?.nativeTitle;
  if (typeof native !== "string" || !native.trim() || !item.year) return null;
  const want = norm(native);
  for (const kind of ["movie", "tv"] as const) {
    try {
      const url = new URL(`https://api.themoviedb.org/3/search/${kind}`);
      url.searchParams.set("api_key", env.TMDB_API_KEY);
      url.searchParams.set("query", native.trim());
      url.searchParams.set("language", "ja-JP");
      url.searchParams.set("include_adult", "false");
      const res = await fetch(url, { next: { revalidate: DAY } });
      if (!res.ok) continue;
      const json = (await res.json()) as { results?: { id?: unknown; original_title?: unknown; original_name?: unknown; release_date?: unknown; first_air_date?: unknown }[] };
      for (const r of json.results ?? []) {
        const title = kind === "movie" ? r.original_title : r.original_name;
        const year = Number(String((kind === "movie" ? r.release_date : r.first_air_date) ?? "").slice(0, 4));
        if (typeof title === "string" && norm(title) === want && Math.abs(year - item.year) <= 1 && typeof r.id === "number") {
          return { kind, id: String(r.id) };
        }
      }
    } catch {
      // sin red o sin respuesta: se sigue sin sala
    }
  }
  return null;
}

/**
 * Arte apaisado sin rótulo de la obra (`art`) y otra imagen distinta para el
 * marco del tráiler (`trailerArt`); `null` si el proveedor no las da.
 * Anime: por TMDB (ver `tmdbForAnime`); sin coincidencia, Pieza.
 */
export async function wideArt(item: MediaItem): Promise<{ art: CoverSource | null; trailerArt: CoverSource | null }> {
  if (item.type === "movie" || item.type === "tv") {
    const list = await tmdbTextless(item.type, item.externalId);
    if (list.length) return { art: tmdbArt(list[0]), trailerArt: list[1] ? tmdbArt(list[1]) : null };
    // Sin imágenes sin texto: el fondo de la ficha (TMDB no dice aquí su tamaño; `w1280` existe siempre).
    const file = item.backdrop?.match(/(\/[\w-]+\.(?:jpg|png|webp))$/)?.[1];
    return { art: file ? tmdbArt({ file, w: 1280, h: 720 }) : null, trailerArt: null };
  }
  if (item.type === "game") return { art: rawgArt(item.poster), trailerArt: null };
  if (item.type === "anime") {
    const hit = await tmdbForAnime(item);
    const list = hit ? await tmdbTextless(hit.kind, hit.id) : [];
    return { art: list[0] ? tmdbArt(list[0]) : null, trailerArt: list[1] ? tmdbArt(list[1]) : null };
  }
  return { art: null, trailerArt: null };
}
