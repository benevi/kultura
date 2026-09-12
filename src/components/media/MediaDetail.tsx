// ============================================================
// KULTURA — MediaDetail (F4)
// Ficha de detalle de un título cultural. Hero cinematográfico
// tipo "reportaje/portada" (backdrop a sangre + scrim + poster
// grande superpuesto) + badges reales (match score de F3a,
// puntuación) + tiles de datos con iconos propios (F1b).
// Server Component async (usa getTranslations).
// ============================================================

import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { MediaItem, StreamingProvider } from "@/types/media";
import type { LibraryEntry } from "@/types/library";
import { TrailerEmbed } from "./TrailerEmbed";
import { StreamingProviders } from "./StreamingProviders";
import { SynopsisSection } from "./SynopsisSection";
import { LibraryAction } from "@/components/library/LibraryAction";
import { RecommendButton } from "@/components/social/RecommendButton";
import { AddToListButton } from "@/components/social/AddToListButton";
import { ReportButton } from "@/components/social/ReportButton";
import {
  IconCalendar,
  IconFormat,
  IconStar,
  IconClock,
  IconLayers,
  type KIcon,
} from "@/components/icons";

interface MediaDetailProps {
  item: MediaItem;
  trailerKey?: string;
  providers?: StreamingProvider[];
  initialEntry: LibraryEntry | null;
  isAuthenticated: boolean;
  /**
   * Match score real 0-100 (F3a, `computeMatchScores`) calculado para este
   * único item. Ausente = sin badge — nunca un número decorativo cuando no
   * hay señal suficiente en la biblioteca del usuario para calcularlo.
   */
  matchScore?: number;
}

interface DetailTile {
  key: string;
  icon: KIcon;
  label: string;
  value: string;
  hint?: string;
}

function getExtraDetailValue(item: MediaItem): { key: "duration" | "episodes"; value: string } | null {
  const m = item.metadata;
  if (!m) return null;
  if (item.type === "movie" && typeof m.runtime === "number") {
    return { key: "duration", value: `${m.runtime} min` };
  }
  if ((item.type === "tv" || item.type === "anime") && typeof m.episodes === "number") {
    return { key: "episodes", value: String(m.episodes) };
  }
  if (item.type === "manga" && typeof m.chapters === "number") {
    return { key: "episodes", value: String(m.chapters) };
  }
  if (item.type === "book" && typeof m.pageCount === "number") {
    return { key: "episodes", value: String(m.pageCount) };
  }
  return null;
}

export async function MediaDetail({
  item,
  trailerKey,
  providers,
  initialEntry,
  isAuthenticated,
  matchScore,
}: MediaDetailProps) {
  const t = await getTranslations("media_detail");
  const tMedia = await getTranslations("media");
  const backdropSrc = item.backdrop ?? item.poster;
  const extraDetail = getExtraDetailValue(item);
  const typeLabel = tMedia(item.type as Parameters<typeof tMedia>[0]);

  const tiles: DetailTile[] = [];
  if (item.year) {
    tiles.push({ key: "year", icon: IconCalendar, label: t("year"), value: String(item.year) });
  }
  tiles.push({ key: "type", icon: IconFormat, label: t("type"), value: typeLabel });
  if (item.rating !== undefined) {
    tiles.push({
      key: "rating",
      icon: IconStar,
      label: t("rating"),
      value: item.rating.toFixed(1),
      hint: item.ratingSource,
    });
  }
  if (extraDetail) {
    tiles.push({
      key: extraDetail.key,
      icon: extraDetail.key === "duration" ? IconClock : IconLayers,
      label: t(extraDetail.key),
      value: extraDetail.value,
    });
  }

  return (
    <div className="min-h-screen">
      {/* Hero cinematográfico */}
      <div className="relative w-full h-[52vh] sm:h-[60vh] md:h-[66vh] min-h-[400px] overflow-hidden">
        {backdropSrc ? (
          <Image
            src={backdropSrc}
            alt={item.title}
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-surface-elevated" />
        )}
        {/* Scrim inferior — legibilidad del contenido superpuesto */}
        <div className="absolute inset-0 bg-gradient-to-t from-surface-base via-surface-base/55 to-transparent" />
        {/* Scrim superior sutil — legibilidad de badges */}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent" />

        {/* Badge de match real (F3a) — solo si hay señal suficiente */}
        {matchScore !== undefined && (
          <div
            data-testid="media-match-badge"
            className="absolute top-4 right-4 rounded-full bg-accent-positive text-on-accent-positive text-xs font-display font-extrabold px-3 py-1.5 leading-none shadow-lg"
          >
            {matchScore}% MATCH
          </div>
        )}

        {/* Contenido del hero */}
        <div className="absolute bottom-0 left-0 right-0 pb-5 md:pb-10">
          <div className="max-w-5xl mx-auto px-4 flex gap-4 md:gap-7 items-end">
            {/* Poster */}
            <div className="w-32 sm:w-40 md:w-52 flex-shrink-0 rounded-bento overflow-hidden shadow-2xl ring-1 ring-white/10 aspect-[2/3] bg-surface-elevated">
              {item.poster ? (
                <Image
                  src={item.poster}
                  alt={item.title}
                  width={208}
                  height={312}
                  sizes="(max-width: 640px) 128px, (max-width: 768px) 160px, 208px"
                  className="w-full h-full object-cover"
                  priority
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-text-tertiary font-display font-bold text-xl">
                    {item.title.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pb-1">
              <h1 className="font-display text-3xl sm:text-4xl md:text-6xl font-bold tracking-tight text-text-primary mb-1.5 line-clamp-3">
                {item.title}
              </h1>
              {item.originalTitle && item.originalTitle !== item.title && (
                <p className="text-text-secondary text-sm mb-2.5">{item.originalTitle}</p>
              )}

              <div className="flex items-center gap-2.5 text-sm text-text-secondary mb-3 flex-wrap">
                {item.year && <span>{item.year}</span>}
                <span>{typeLabel}</span>
                {item.rating !== undefined && (
                  <span className="flex items-center gap-1">
                    <IconStar className="w-3.5 h-3.5 text-accent-highlight" />
                    <span className="text-text-primary font-semibold">
                      {item.rating.toFixed(1)}
                    </span>
                    {item.ratingSource && (
                      <span className="text-text-secondary text-xs">
                        {item.ratingSource}
                      </span>
                    )}
                  </span>
                )}
              </div>

              {item.genres && item.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {item.genres.slice(0, 5).map((g) => (
                    <span
                      key={g}
                      className="text-xs font-semibold bg-surface-elevated/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-text-secondary"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-1">
                <LibraryAction
                  mediaId={item.id}
                  mediaCache={{
                    externalId: item.externalId,
                    type: item.type,
                    title: item.title,
                    poster: item.poster,
                    backdrop: item.backdrop,
                    year: item.year,
                    synopsis: item.synopsis,
                    genres: item.genres,
                  }}
                  initialEntry={initialEntry}
                  isAuthenticated={isAuthenticated}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-5xl mx-auto px-4 mt-8 space-y-10 pb-14">
        {/* Datos clave — tiles con icono propio */}
        {tiles.length > 0 && (
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {tiles.map(({ key, icon: Icon, label, value, hint }) => (
              <div
                key={key}
                className="flex items-center gap-3 rounded-bento bg-surface-elevated p-3 md:p-4"
              >
                <div className="w-9 h-9 rounded-full bg-surface-base flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-accent-positive" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-text-secondary uppercase tracking-wide font-medium">
                    {label}
                  </p>
                  <p className="text-sm font-bold text-text-primary truncate">
                    {value}
                    {hint && <span className="text-text-secondary text-xs font-medium ml-1">{hint}</span>}
                  </p>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Synopsis */}
        {item.synopsis && (
          <section>
            <h2 className="font-display text-xl font-bold text-text-primary mb-3">
              {t("synopsis")}
            </h2>
            <SynopsisSection text={item.synopsis} />
          </section>
        )}

        {/* Streaming providers */}
        {providers && providers.length > 0 && (
          <StreamingProviders providers={providers} title={t("streamingOn")} />
        )}

        {/* Acciones sociales */}
        {isAuthenticated && (
          <div className="flex items-center gap-3 flex-wrap">
            <RecommendButton item={item} />
            <AddToListButton item={item} />
            <ReportButton targetType="media" targetId={item.id} />
          </div>
        )}

        {/* Tráiler */}
        {trailerKey && (
          <section>
            <h2 className="font-display text-xl font-bold text-text-primary mb-3">
              {t("trailer")}
            </h2>
            <div className="max-w-2xl rounded-bento-lg overflow-hidden">
              <TrailerEmbed youtubeKey={trailerKey} title={item.title} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
