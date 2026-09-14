// ============================================================
// KULTURA — Media Detail Page
// Ruta: /[locale]/media/[type]/[id]
// Tipos soportados: movie, tv, anime, manga, book, comic, game
// Server Component — fetch de datos en servidor, sin exponer keys.
// ============================================================

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { MediaType, StreamingProvider } from "@/types/media";
import { getMovie, getMovieVideos, getMovieProviders, getTVVideos, getTVProviders, getTV } from "@/lib/api/tmdb";
import type { TmdbProvidersResponse } from "@/lib/api/tmdb";
import { tmdbRegion } from "@/lib/api/locale";
import { getAnime as getAnimeJikan, getAnimeVideos, getManga as getMangaJikan } from "@/lib/api/jikan";
import { getAnime as getAnimeAniList, isAniListId, fromAniListRef } from "@/lib/api/anilist";
import { getManga as getMangaDex, isMangaDexId } from "@/lib/api/mangadex";
import { getBookDetail } from "@/lib/api/openlibrary";
import {
  getGoogleBookDetail,
  isOpenLibraryLegacyId,
} from "@/lib/api/googlebooks";
import { getGame } from "@/lib/api/rawg";
import { getSteamInfoForGame, type SteamInfo } from "@/lib/api/steam";
import { getComic } from "@/lib/api/comicvine";
import {
  normalizeMovie,
  normalizeTV,
  normalizeAnime,
  normalizeAniListAnime,
  normalizeMangaJikan,
  normalizeMangaDex,
  normalizeBookGoogle,
  normalizeBookOpenLibrary,
  normalizeGame,
  normalizeComic,
} from "@/lib/api/normalizer";
import { MediaDetail } from "@/components/media/MediaDetail";
import { createClient } from "@/lib/supabase/server";
import { getMediaEntry } from "@/lib/library/queries";
import { computeMatchScores } from "@/lib/recommendations/match-score";
import { translateSynopsis } from "@/lib/translate/synopsis";
import type { LibraryEntry } from "@/types/library";

// ── Constants ─────────────────────────────────────────────────────────────────

const VALID_TYPES: MediaType[] = [
  "movie",
  "tv",
  "anime",
  "manga",
  "book",
  "comic",
  "game",
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ locale: string; type: string; id: string }>;
}

// ── Helper: extractors ────────────────────────────────────────────────────────

// E-TMDB-LOCALE: la oferta de streaming es POR PAÍS. Antes se leía siempre
// `results["ES"]`, así que al pedir la región del locale `en` (US) la sección
// quedaba vacía. Ahora el extractor recibe la misma región que se pidió a TMDB.
function extractProvidersForRegion(
  resp: TmdbProvidersResponse,
  region: string
): StreamingProvider[] {
  const forRegion = resp.results?.[region];
  if (!forRegion) return [];
  const all: StreamingProvider[] = [];
  (["flatrate", "rent", "buy"] as const).forEach((type) => {
    forRegion[type]?.forEach((p) =>
      all.push({
        name: p.provider_name,
        logoPath: `https://image.tmdb.org/t/p/original${p.logo_path}`,
        type,
      })
    );
  });
  return all;
}

// ── Helper: libro (Google Books + fallback legacy Open Library) ───────────────

/**
 * Resuelve la ficha de un libro (E-BOOKS-GOOGLE).
 *
 * Fuente actual: Google Books (`book_{volumeId}`). Pero las bibliotecas creadas
 * mientras los libros venían de Open Library (E84b/E84c) guardaron
 * `book_OL7353617W`; pedirle ese id a Google Books daría 404 y la ficha de un
 * libro YA GUARDADO se rompería. Por eso se enruta por la forma del id y Open
 * Library se conserva exclusivamente para ese caso legacy.
 */
async function resolveBookItem(id: string) {
  if (isOpenLibraryLegacyId(id)) {
    const legacy = await getBookDetail(id).catch(() => null);
    if (!legacy) return null;
    const item = normalizeBookOpenLibrary(legacy.doc);
    if (legacy.description) item.synopsis = legacy.description;
    return item;
  }
  const volume = await getGoogleBookDetail(id).catch(() => null);
  return volume ? normalizeBookGoogle(volume) : null;
}

// ── Helper: manga (MangaDex + fallback legacy Jikan) ──────────────────────────

/**
 * Resuelve la ficha de un manga (E-MANGA-SOURCE).
 *
 * Fuente actual: MangaDex (`manga_{uuid}`). Las bibliotecas guardadas mientras
 * manga venía de Jikan tienen `manga_{mal_id}` (numérico) — pedirle ese id a
 * MangaDex sería un 404, así que se enruta por la forma del id (mismo patrón
 * que `resolveBookItem` con Open Library legacy).
 */
async function resolveMangaItem(id: string, locale?: string) {
  if (isMangaDexId(id)) {
    const detail = await getMangaDex(id).catch(() => null);
    return detail ? normalizeMangaDex(detail.data, locale) : null;
  }
  const legacy = await getMangaJikan(Number(id)).catch(() => null);
  return legacy ? normalizeMangaJikan(legacy.data) : null;
}

// ── Helper: anime (AniList + fallback legacy Jikan) ───────────────────────────

/**
 * Resuelve la ficha de un anime (E-ANIME-SOURCE), incluido el trailer.
 *
 * Fuente actual: AniList (`anime_al-{id}`). Las bibliotecas guardadas mientras
 * anime venía de Jikan tienen `anime_{mal_id}` (entero plano) — se enruta por
 * la forma del id (mismo patrón que `resolveMangaItem`/`resolveBookItem`).
 * AniList trae el trailer inline en la propia consulta; Jikan legacy necesita
 * una segunda llamada (`getAnimeVideos`), de ahí que esta función devuelva
 * `trailerKey` ya resuelto en vez de solo el item. Sin parámetro `locale`:
 * AniList no ofrece títulos/sinopsis en español (solo romaji/inglés/nativo,
 * ver `normalizeAniListAnime`), a diferencia de MangaDex/Google Books.
 */
async function resolveAnimeItem(
  id: string
): Promise<{ item: ReturnType<typeof normalizeAnime>; trailerKey?: string } | null> {
  if (isAniListId(id)) {
    const raw = await getAnimeAniList(fromAniListRef(id)).catch(() => null);
    if (!raw) return null;
    const item = normalizeAniListAnime(raw);
    return { item, trailerKey: item.trailerKey };
  }

  const numId = Number(id);
  const [detail, videos] = await Promise.allSettled([
    getAnimeJikan(numId),
    getAnimeVideos(numId),
  ]);
  if (detail.status === "rejected") return null;
  const item = normalizeAnime(detail.value.data);
  const trailerKey =
    videos.status === "fulfilled"
      ? (videos.value.data.promo?.[0]?.trailer?.youtube_id ?? undefined)
      : undefined;
  return { item, trailerKey };
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, type, id } = await params;

  if (!VALID_TYPES.includes(type as MediaType)) return { title: "KULTURA" };

  try {
    let title: string | undefined;
    let description: string | undefined;
    let image: string | undefined;

    if (type === "movie") {
      const detail = await getMovie(Number(id), locale);
      title = detail.title;
      description = detail.overview || undefined;
      if (detail.poster_path) image = `https://image.tmdb.org/t/p/w500${detail.poster_path}`;
    } else if (type === "tv") {
      const detail = await getTV(Number(id), locale);
      title = detail.name;
      description = detail.overview || undefined;
      if (detail.poster_path) image = `https://image.tmdb.org/t/p/w500${detail.poster_path}`;
    } else if (type === "anime") {
      const resolved = await resolveAnimeItem(id);
      if (resolved) {
        title = resolved.item.title;
        description = resolved.item.synopsis;
        image = resolved.item.poster;
      }
    } else if (type === "manga") {
      const item = await resolveMangaItem(id, locale);
      if (item) {
        title = item.title;
        description = item.synopsis;
        image = item.poster;
      }
    } else if (type === "book") {
      const item = await resolveBookItem(id);
      if (item) {
        title = item.title;
        description = item.synopsis;
        image = item.poster;
      }
    } else if (type === "game") {
      const detail = await getGame(Number(id));
      title = detail.name;
      description = detail.description_raw;
      image = detail.background_image ?? undefined;
    } else if (type === "comic") {
      const norm = normalizeComic(await getComic(id));
      title = norm.title;
      description = norm.synopsis;
      image = norm.poster;
    }

    if (!title) return { title: "KULTURA" };

    // E-SINOPSIS-I18N: `cacheOnly` a propósito. Los metadatos corren en el
    // camino crítico de la respuesta y solo alimentan OG/SEO: si otro visitante
    // ya pagó la traducción de este título se aprovecha, y si no, se sirve el
    // original en vez de hacer esperar la página por 160 caracteres.
    const localizedDesc = description
      ? await translateSynopsis({
          text: description,
          locale,
          mediaId: `${type}_${id}`,
          cacheOnly: true,
        })
      : undefined;

    const truncatedDesc = localizedDesc ? localizedDesc.slice(0, 160) : undefined;

    return {
      title: `${title} · KULTURA`,
      description: truncatedDesc,
      openGraph: {
        title: `${title} · KULTURA`,
        description: truncatedDesc,
        type: type === 'movie' ? 'video.movie' : 'website',
        ...(image ? { images: [{ url: image, width: 500, alt: title }] } : {}),
      },
      twitter: {
        card: image ? 'summary_large_image' : 'summary',
        title: `${title} · KULTURA`,
        description: truncatedDesc,
        ...(image ? { images: [image] } : {}),
      },
    };
  } catch {
    return { title: "KULTURA" };
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function MediaDetailPage({ params }: Props) {
  const { locale, type, id } = await params;
  // E-TMDB-LOCALE: `locale` ya viaja en la ruta (`/[locale]/media/...`) → se
  // pasa a cada cliente de API que localiza contenido. La ficha deja de estar
  // fijada a español.
  const providerRegion = tmdbRegion(locale);

  if (!VALID_TYPES.includes(type as MediaType)) notFound();

  const mediaType = type as MediaType;

  // Auth: comprobar si el usuario está autenticado y obtener su entrada de biblioteca
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let initialEntry: LibraryEntry | null = null
  if (user) {
    initialEntry = await getMediaEntry(user.id, `${mediaType}_${id}`).catch(() => null)
  }
  const isAuthenticated = !!user

  // item puede quedar undefined si el bloque de lógica no asigna
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let item: ReturnType<typeof normalizeMovie> | undefined;
  let trailerKey: string | undefined;
  let providers: StreamingProvider[] | undefined;
  // E-GAMES-STEAM: enriquecimiento de la ficha de juego. `null` = no se pudo
  // resolver el appid con confianza (o Steam no respondió) → sin sección.
  let steam: SteamInfo | null = null;

  try {
    if (mediaType === "movie") {
      const numId = Number(id);
      const [detail, videos, prov] = await Promise.allSettled([
        getMovie(numId, locale),
        getMovieVideos(numId, locale),
        getMovieProviders(numId, providerRegion, locale),
      ]);
      if (detail.status === "rejected") notFound();
      item = normalizeMovie(detail.value);
      if (videos.status === "fulfilled") {
        const trailer = videos.value.results.find(
          (v) => v.site === "YouTube" && v.type === "Trailer"
        );
        trailerKey = trailer?.key;
      }
      if (prov.status === "fulfilled") {
        providers = extractProvidersForRegion(prov.value, providerRegion);
      }
    } else if (mediaType === "tv") {
      const numId = Number(id);
      const [detail, videos, prov] = await Promise.allSettled([
        getTV(numId, locale),
        getTVVideos(numId, locale),
        getTVProviders(numId, providerRegion, locale),
      ]);
      if (detail.status === "rejected") notFound();
      item = normalizeTV(detail.value);
      if (videos.status === "fulfilled") {
        const trailer = videos.value.results.find(
          (v) => v.site === "YouTube" && v.type === "Trailer"
        );
        trailerKey = trailer?.key;
      }
      if (prov.status === "fulfilled") {
        providers = extractProvidersForRegion(prov.value, providerRegion);
      }
    } else if (mediaType === "anime") {
      const resolved = await resolveAnimeItem(id);
      if (!resolved) notFound();
      item = resolved.item;
      trailerKey = resolved.trailerKey;
    } else if (mediaType === "manga") {
      const manga = await resolveMangaItem(id, locale);
      if (!manga) notFound();
      item = manga;
    } else if (mediaType === "book") {
      const book = await resolveBookItem(id);
      if (!book) notFound();
      item = book;
    } else if (mediaType === "game") {
      const detail = await getGame(Number(id)).catch(() => null);
      if (!detail) notFound();
      item = normalizeGame(detail);
      // Nunca lanza: `getSteamInfoForGame` captura todo y devuelve null.
      steam = await getSteamInfoForGame(detail, locale);
    } else if (mediaType === "comic") {
      const detail = await getComic(id).catch(() => null);
      if (!detail) notFound();
      item = normalizeComic(detail);
    }
  } catch {
    notFound();
  }

  if (!item) notFound();

  // Match score real (F3a) para este único título — mismo gate de señal
  // mínima que el resto de superficies (Discover/Home): sin biblioteca
  // suficiente, computeMatchScores devuelve un Map vacío y no se pinta badge.
  let matchScore: number | undefined;
  if (user) {
    const scores = await computeMatchScores(user.id, [item], supabase).catch(() => new Map<string, number>());
    matchScore = scores.get(item.id);
  }

  return (
    <MediaDetail
      item={item}
      trailerKey={trailerKey}
      providers={providers}
      initialEntry={initialEntry}
      isAuthenticated={isAuthenticated}
      matchScore={matchScore}
      steam={steam}
    />
  );
}
