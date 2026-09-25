// ============================================================
// KULTURA — MediaDetail (F0)
// Ficha de detalle de un título cultural. Layout de dos columnas
// tal y como se diseñó a mano en el canvas F0 ("Kultura Editorial"):
// poster grande con badge de match "colgante" + chips + CTAs a la
// izquierda, explicación de recomendación + sinopsis + tráiler a
// la derecha. Ver CLAUDE.md — fuente de verdad del sistema visual.
// Server Component async (usa getTranslations).
// ============================================================

import Image from "next/image";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import type { MediaItem, StreamingProvider } from "@/types/media";
import type { LibraryEntry } from "@/types/library";
import type { SteamInfo } from "@/lib/api/steam";
import { TrailerEmbed } from "./TrailerEmbed";
import { StreamingProviders } from "./StreamingProviders";
import { SynopsisSection } from "./SynopsisSection";
import { TranslatedSynopsis } from "./TranslatedSynopsis";
import { SteamSection } from "./SteamSection";
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
   * Match score real 0-100 (`computeMatchScores`) calculado para este único
   * item. E-MATCH-SIN-BADGE: YA NO SE PINTA. Se sigue recibiendo porque es la
   * señal de que hay afinidad calculable para este usuario (biblioteca con
   * géneros suficientes): sin él, "Por qué te lo recomendamos" le diría
   * "coincide con géneros que ya te gustan" a alguien de cuyos gustos no
   * sabemos nada. Actúa de compuerta, no de dato visible.
   */
  matchScore?: number;
  /**
   * E-GAMES-STEAM: datos de tienda de Steam para la ficha de un juego. Opcional
   * a propósito — si no se pudo resolver el `appid` con confianza llega
   * `undefined`/`null` y la ficha se pinta sin la sección.
   */
  steam?: SteamInfo | null;
}

interface DetailTile {
  key: string;
  icon: KIcon;
  label: string;
  value: string;
  hint?: string;
}

// ── Poster fallback (sin imagen real) ────────────────────────────────────────
// Misma fórmula que "Posters/cards sin imagen real" + "Cards feature grandes"
// del sistema de diseño (CLAUDE.md): degradado lineal de dos paradas del mismo
// matiz + acento radial en la esquina superior-izquierda. El matiz se deriva
// del id del item (determinista) para variar entre títulos sin depender de
// un helper compartido — MediaCard no expone uno hoy, así que esto vive local
// a MediaDetail siguiendo exactamente la misma receta de valores.
const POSTER_HUES = [350, 130, 55, 300, 250, 95] as const;

function posterGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const hue = POSTER_HUES[hash % POSTER_HUES.length];
  return [
    `radial-gradient(120% 90% at 20% 15%, oklch(50% 0.16 ${hue} / 0.55) 0%, transparent 55%)`,
    `linear-gradient(160deg, oklch(38% 0.13 ${hue}), oklch(18% 0.06 ${hue}))`,
  ].join(", ");
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
  steam,
}: MediaDetailProps) {
  const t = await getTranslations("media_detail");
  const tMedia = await getTranslations("media");
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

  // "Por qué te lo recomendamos" — nunca texto de IA fabricado: MediaDetail no
  // tiene hoy una explicación por-item generada por Claude (eso solo existe
  // como feed agregado en /home vía getAiRecommendations, que no toma un
  // item concreto como entrada). Esta sección se construye únicamente con
  // datos reales ya presentes en esta página (los géneros del item) y se
  // oculta por completo si no hay señal: `matchScore` es la compuerta que
  // dice que SÍ hay afinidad calculada para este usuario, aunque su valor ya
  // no se enseñe.
  const topGenres = item.genres?.slice(0, 3) ?? [];
  const showWhyRecommended = matchScore !== undefined && topGenres.length > 0;

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 md:px-14 pt-3 pb-14">
        <section className="flex flex-col md:flex-row gap-8 md:gap-14">
          {/* ── Columna izquierda: poster ── */}
          <div className="w-full md:w-[420px] flex-shrink-0">
            <div className="relative">
              <div
                className="relative w-full aspect-[3/4] rounded-[32px] overflow-hidden flex items-end p-6 md:p-8"
                style={{ boxShadow: "12px 12px 0 oklch(26% 0.025 280)" }}
              >
                {item.poster ? (
                  <Image
                    src={item.poster}
                    alt={item.title}
                    fill
                    sizes="(max-width: 768px) 90vw, 420px"
                    className="object-cover"
                    priority
                  />
                ) : (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ background: posterGradient(item.id) }}
                  >
                    <span className="text-white/90 font-display font-extrabold text-3xl">
                      {item.title.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                )}

                {/* Scrim inferior — legibilidad del título superpuesto */}
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />

                <div className="relative z-[1] w-full">
                  <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white line-clamp-3">
                    {item.title}
                  </h1>
                  {item.originalTitle && item.originalTitle !== item.title && (
                    <p className="text-white/70 text-sm mt-1 line-clamp-1">
                      {item.originalTitle}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Chips: tipo / año / rating / episodios (CLAUDE.md — chip inactivo) */}
            {tiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {tiles.map(({ key, icon: Icon, label, value, hint }) => (
                  <span
                    key={key}
                    aria-label={label}
                    className="inline-flex items-center gap-1.5 rounded-full bg-surface-elevated text-text-primary font-bold text-xs px-4 py-2"
                  >
                    <Icon className="w-3.5 h-3.5 text-text-tertiary" />
                    {value}
                    {hint && (
                      <span className="text-text-tertiary font-medium">{hint}</span>
                    )}
                  </span>
                ))}
              </div>
            )}

            {/* Géneros — chip "outline" (CLAUDE.md) */}
            {item.genres && item.genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2.5">
                {item.genres.slice(0, 5).map((g) => (
                  <span
                    key={g}
                    className="rounded-full border-2 border-surface-border text-text-secondary font-bold text-xs px-3.5 py-1.5"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}

            {/* CTAs — primario "+ Añadir a mi biblioteca" / secundarios */}
            <div className="flex flex-col gap-2.5 mt-6">
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

              {isAuthenticated && (
                <div className="flex items-center gap-2.5 flex-wrap">
                  <AddToListButton item={item} />
                  <RecommendButton item={item} />
                  <ReportButton targetType="media" targetId={item.id} />
                </div>
              )}
            </div>
          </div>

          {/* ── Columna derecha: info ── */}
          <div className="flex-1 min-w-0 pt-1 md:pt-2 space-y-8">
            {/* Por qué te lo recomendamos — solo con señal real (ver arriba) */}
            {showWhyRecommended && (
              <section>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-elevated text-text-primary font-bold text-xs px-4 py-2 mb-3">
                  🤖 {t("whyRecommended")}
                </span>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {t("whyRecommendedText", { genres: topGenres.join(", ") })}
                </p>
              </section>
            )}

            {/* Sinopsis */}
            {item.synopsis && (
              <section>
                <h2 className="font-display text-xl font-bold text-text-primary mb-3">
                  {t("synopsis")}
                </h2>
                {/* E-SINOPSIS-I18N: AniList, RAWG y ComicVine solo publican
                    inglés. La traducción se resuelve fuera del render crítico
                    — el fallback es el texto original, así que la ficha nunca
                    espera y nunca se queda sin sinopsis. */}
                <Suspense fallback={<SynopsisSection text={item.synopsis} />}>
                  <TranslatedSynopsis text={item.synopsis} mediaId={item.id} />
                </Suspense>
              </section>
            )}

            {/* Steam (solo juegos, y solo si se resolvió la ficha de tienda) */}
            {steam && <SteamSection steam={steam} />}

            {/* Streaming providers */}
            {providers && providers.length > 0 && (
              <StreamingProviders providers={providers} title={t("streamingOn")} />
            )}

            {/* Tráiler — iframe real (ya embebido, no hay paso de miniatura) */}
            {trailerKey && (
              <section>
                <h2 className="font-display text-xl font-bold text-text-primary mb-3">
                  {t("trailer")}
                </h2>
                <TrailerEmbed youtubeKey={trailerKey} title={item.title} />
              </section>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
