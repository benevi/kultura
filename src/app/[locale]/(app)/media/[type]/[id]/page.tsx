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
import { getAnime, getAnimeVideos, getManga } from "@/lib/api/jikan";
import { getBookDetail } from "@/lib/api/openlibrary";
import { getGame } from "@/lib/api/rawg";
import { getComic } from "@/lib/api/comicvine";
import {
  normalizeMovie,
  normalizeTV,
  normalizeAnime,
  normalizeMangaJikan,
  normalizeBookOpenLibrary,
  normalizeGame,
  normalizeComic,
} from "@/lib/api/normalizer";
import { MediaDetail } from "@/components/media/MediaDetail";
import { createClient } from "@/lib/supabase/server";
import { getMediaEntry } from "@/lib/library/queries";
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

function extractProvidersES(resp: TmdbProvidersResponse): StreamingProvider[] {
  const es = resp.results?.["ES"];
  if (!es) return [];
  const all: StreamingProvider[] = [];
  (["flatrate", "rent", "buy"] as const).forEach((type) => {
    es[type]?.forEach((p) =>
      all.push({
        name: p.provider_name,
        logoPath: `https://image.tmdb.org/t/p/original${p.logo_path}`,
        type,
      })
    );
  });
  return all;
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type, id } = await params;

  if (!VALID_TYPES.includes(type as MediaType)) return { title: "KULTURA" };

  try {
    let title: string | undefined;
    let description: string | undefined;
    let image: string | undefined;

    if (type === "movie") {
      const detail = await getMovie(Number(id));
      title = detail.title;
      description = detail.overview || undefined;
      if (detail.poster_path) image = `https://image.tmdb.org/t/p/w500${detail.poster_path}`;
    } else if (type === "tv") {
      const detail = await getTV(Number(id));
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
      const detail = await getBookDetail(id);
      if (detail) {
        const item = normalizeBookOpenLibrary(detail.doc);
        title = item.title;
        description = detail.description;
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
  const { type, id } = await params;

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

  try {
    if (mediaType === "movie") {
      const numId = Number(id);
      const [detail, videos, prov] = await Promise.allSettled([
        getMovie(numId),
        getMovieVideos(numId),
        getMovieProviders(numId),
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
        providers = extractProvidersES(prov.value);
      }
    } else if (mediaType === "tv") {
      const numId = Number(id);
      const [detail, videos, prov] = await Promise.allSettled([
        getTV(numId),
        getTVVideos(numId),
        getTVProviders(numId),
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
        providers = extractProvidersES(prov.value);
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
      const detail = await getBookDetail(id).catch(() => null);
      if (!detail) notFound();
      item = normalizeBookOpenLibrary(detail.doc);
      if (detail.description) item.synopsis = detail.description;
    } else if (mediaType === "game") {
      const detail = await getGame(Number(id)).catch(() => null);
      if (!detail) notFound();
      item = normalizeGame(detail);
    } else if (mediaType === "comic") {
      const detail = await getComic(id).catch(() => null);
      if (!detail) notFound();
      item = normalizeComic(detail);
    }
  } catch {
    notFound();
  }

  if (!item) notFound();

  return (
    <MediaDetail
      item={item}
      trailerKey={trailerKey}
      providers={providers}
      initialEntry={initialEntry}
      isAuthenticated={isAuthenticated}
    />
  );
}
