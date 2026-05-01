// ============================================================
// KULTURA — MediaDetail
// Componente de detalle completo de un título cultural.
// Hero con backdrop borroso + poster + info + LibraryAction.
// Abajo: synopsis truncable, detalles, streaming, tráiler.
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
import { ReportButton } from "@/components/social/ReportButton";

interface MediaDetailProps {
  item: MediaItem;
  trailerKey?: string;
  providers?: StreamingProvider[];
  initialEntry: LibraryEntry | null;
  isAuthenticated: boolean;
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
}: MediaDetailProps) {
  const t = await getTranslations("media_detail");
  const tMedia = await getTranslations("media");
  const backdropSrc = item.backdrop ?? item.poster;
  const extraDetail = getExtraDetailValue(item);
  const typeLabel = tMedia(item.type as Parameters<typeof tMedia>[0]);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="relative w-full min-h-64 md:min-h-80 overflow-hidden">
        {/* Backdrop borroso */}
        {backdropSrc ? (
          <Image
            src={backdropSrc}
            alt={item.title}
            fill
            className="object-cover blur-md scale-110 opacity-30"
            sizes="100vw"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-surface2" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/60 to-transparent" />

        {/* Contenido del hero */}
        <div className="absolute bottom-0 left-0 right-0 pb-4 md:pb-8">
          <div className="max-w-4xl mx-auto px-4 flex gap-4 md:gap-6 items-end">
            {/* Poster */}
            <div className="w-28 md:w-40 flex-shrink-0 rounded-lg overflow-hidden shadow-xl aspect-[2/3] bg-surface2">
              {item.poster ? (
                <Image
                  src={item.poster}
                  alt={item.title}
                  width={160}
                  height={240}
                  sizes="(max-width: 768px) 112px, 160px"
                  className="w-full h-full object-cover"
                  priority
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-muted text-lg font-medium">
                    {item.title.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pb-1">
              <h1 className="font-display text-2xl md:text-4xl font-bold tracking-wide text-text mb-1 line-clamp-3">
                {item.title}
              </h1>
              {item.originalTitle && item.originalTitle !== item.title && (
                <p className="text-muted text-sm mb-2">{item.originalTitle}</p>
              )}

              <div className="flex items-center gap-2 text-sm text-muted mb-3 flex-wrap">
                {item.year && <span>{item.year}</span>}
                <span>{typeLabel}</span>
                {item.rating !== undefined && (
                  <span className="flex items-center gap-1">
                    <span className="text-accent">★</span>
                    <span className="text-text font-medium">
                      {item.rating.toFixed(1)}
                    </span>
                    {item.ratingSource && (
                      <span className="text-muted/60 text-xs">
                        {item.ratingSource}
                      </span>
                    )}
                  </span>
                )}
              </div>

              {item.genres && item.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {item.genres.slice(0, 5).map((g) => (
                    <span
                      key={g}
                      className="text-xs bg-surface2/80 backdrop-blur-sm px-2 py-0.5 rounded-full text-muted"
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
      <div className="max-w-4xl mx-auto px-4 mt-6 space-y-8 pb-12">
        {/* Synopsis */}
        {item.synopsis && (
          <section>
            <h2 className="font-display text-xl text-text mb-3">
              {t("synopsis")}
            </h2>
            <SynopsisSection text={item.synopsis} />
          </section>
        )}

        {/* Detalles */}
        {(item.year || item.rating !== undefined || extraDetail) && (
          <section>
            <h2 className="font-display text-xl text-text mb-3">
              {t("details")}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {item.year && (
                <div>
                  <p className="text-xs text-muted uppercase tracking-wide">
                    {t("year")}
                  </p>
                  <p className="text-sm font-medium mt-0.5 text-text">
                    {item.year}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted uppercase tracking-wide">
                  {t("type")}
                </p>
                <p className="text-sm font-medium mt-0.5 text-text">
                  {typeLabel}
                </p>
              </div>
              {item.rating !== undefined && (
                <div>
                  <p className="text-xs text-muted uppercase tracking-wide">
                    {t("rating")}
                  </p>
                  <p className="text-sm font-medium mt-0.5 text-text">
                    {item.rating.toFixed(1)}
                    {item.ratingSource && (
                      <span className="text-muted text-xs ml-1">
                        {item.ratingSource}
                      </span>
                    )}
                  </p>
                </div>
              )}
              {extraDetail && (
                <div>
                  <p className="text-xs text-muted uppercase tracking-wide">
                    {t(extraDetail.key)}
                  </p>
                  <p className="text-sm font-medium mt-0.5 text-text">
                    {extraDetail.value}
                  </p>
                </div>
              )}
            </div>
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
            <ReportButton targetType="media" targetId={item.id} />
          </div>
        )}

        {/* Tráiler */}
        {trailerKey && (
          <section>
            <h2 className="font-display text-xl text-text mb-3">
              {t("trailer")}
            </h2>
            <div className="max-w-2xl">
              <TrailerEmbed youtubeKey={trailerKey} title={item.title} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
