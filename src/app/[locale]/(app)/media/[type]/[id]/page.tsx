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
import { getAnime, getAnimeVideos, getManga } from "@/lib/api/jikan";
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
  normalizeMangaJikan,
  normalizeBookGoogle,
  normalizeBookOpenLibrary,
  normalizeGame,
  normalizeComic,
} from "@/lib/api/normalizer";
import { MediaDetail } from "@/components/media/MediaDetail";
import { createClient } from "@/lib/supabase/server";
import { getMediaEntry } from "@/lib/library/queries";
import { computeMatchScores } from "@/lib/recommendations/match-score";
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
      const resp = await getAnime(Number(id));
      title = resp.data.title_english ?? resp.data.title;
      description = resp.data.synopsis ?? undefined;
      image = resp.data.images?.jpg?.large_image_url ?? undefined;
    } else if (type === "manga") {
      const resp = await getManga(Number(id));
      title = resp.data.title;
      description = resp.data.synopsis ?? undefined;
      image = resp.data.images?.jpg?.large_image_url ?? undefined;
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

    const truncatedDesc = description ? description.slice(0, 160) : undefined;

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
      const numId = Number(id);
      const [detail, videos] = await Promise.allSettled([
        getAnime(numId),
        getAnimeVideos(numId),
      ]);
      if (detail.status === "rejected") notFound();
      item = normalizeAnime(detail.value.data);
      if (videos.status === "fulfilled") {
        const promo = videos.value.data.promo?.[0]?.trailer?.youtube_id;
        trailerKey = promo ?? undefined;
      }
    } else if (mediaType === "manga") {
      const detail = await getManga(Number(id)).catch(() => null);
      if (!detail) notFound();
      item = normalizeMangaJikan(detail.data);
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
