// ============================================================
// KULTURA — MediaDetail (F0)
// Ficha de detalle de un título cultural. Layout de dos columnas
// tal y como se diseñó a mano en el canvas F0 ("Kultura Editorial"):
// poster grande + chips + CTAs a la izquierda, sinopsis, ficha
// técnica, "Dónde ver" y tráiler a la derecha. Ver DISENO.md — fuente
// de verdad del sistema visual. Server Component async.
//
// Es PÚBLICA (D-01): sin sesión, el CTA principal lleva al registro con
// `next` de vuelta aquí y la denuncia va al formulario sin cuenta de
// `/report`; con sesión, biblioteca, listas, recomendar y denunciar.
// ============================================================

import { PosterImage } from "@/components/media/PosterImage";
import { Suspense, type ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import type { MediaItem, StreamingProvider } from "@/types/media";
import type { LibraryEntry } from "@/types/library";
import type { SteamInfo } from "@/lib/api/steam";
import type { SourceLink } from "@/lib/media/source-link";
import type { KulturaRating } from "@/lib/media/kultura-rating";
import { mediaPath } from "@/lib/media/seo";
import { synopsisLang } from "@/lib/media/synopsis-lang";
import { Link } from "@/i18n/navigation";
import { KButton } from "@/components/ui/KButton";
import { SOURCE_LINK_CLASS } from "@/components/legal/DataAttribution";
import { TrailerEmbed } from "./TrailerEmbed";
import { StreamingProviders } from "./StreamingProviders";
import { SynopsisSection } from "./SynopsisSection";
import { TranslatedSynopsis } from "./TranslatedSynopsis";
import { SteamSection } from "./SteamSection";
import { ShareRatingButton } from "./ShareRatingButton";
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

/** Un paso de la miga de pan (ruta sin idioma, para el `Link` de next-intl). */
export interface Breadcrumb {
  name: string;
  href: string;
}

interface MediaDetailProps {
  item: MediaItem;
  /** Géneros en el idioma de la página (F-06). Sin ellos, los del proveedor. */
  genreLabels?: string[];
  trailerKey?: string;
  providers?: StreamingProvider[];
  /** Página "dónde ver" de TMDB del título (PRO-2). */
  watchLink?: string;
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
  /** Página del título en su proveedor: cita de la fuente (RAWG la exige). */
  source?: SourceLink | null;
  /** Nota media de KULTURA (solo con notas suficientes). */
  kulturaRating?: KulturaRating | null;
  /** Pasos anteriores a la ficha (el último, el título, lo añade la ficha). */
  breadcrumbs?: Breadcrumb[];
  /**
   * F-29: "También existe como…" (`AdaptationsSection` dentro de un
   * <Suspense>, lo monta la página). Sin él, la ficha sale igual que antes.
   */
  adaptations?: ReactNode;
  /**
   * CRE-8a: enlace firmado y nota del usuario con sesión que ya ha puntuado
   * este título ("Compartir mi nota"). Solo para el dueño de la nota.
   */
  shareRating?: { path: string; rating: string } | null;
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
// del sistema de diseño (DISENO.md): degradado lineal de dos paradas del mismo
// matiz + acento radial en la esquina superior-izquierda. El matiz se deriva
// del id del item (determinista) para variar entre títulos.
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

type ExtraKey = "duration" | "episodes" | "chapters" | "pages";

function getExtraDetailValue(item: MediaItem): { key: ExtraKey; value: number } | null {
  const m = item.metadata;
  if (!m) return null;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
  if (item.type === "movie" && n(m.runtime)) return { key: "duration", value: n(m.runtime)! };
  if ((item.type === "tv" || item.type === "anime") && n(m.episodes)) {
    return { key: "episodes", value: n(m.episodes)! };
  }
  if (item.type === "manga" && n(m.chapters)) return { key: "chapters", value: n(m.chapters)! };
  if (item.type === "book" && n(m.pageCount)) return { key: "pages", value: n(m.pageCount)! };
  return null;
}

type CreditKey = "director" | "cast" | "studio" | "authors" | "publisher" | "platforms" | "developers" | "seasons";

/** Ficha técnica: solo lo que el proveedor da de verdad, en el orden de cada formato. */
function getCredits(item: MediaItem): { key: CreditKey; value: string }[] {
  const m = item.metadata ?? {};
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const list = (v: unknown, max: number) =>
    Array.isArray(v)
      ? v
          .map(text)
          .filter((s): s is string => Boolean(s))
          .slice(0, max)
          .join(", ") || null
      : null;
  const count = (v: unknown) => (typeof v === "number" && v > 0 ? String(v) : null);
  const byType: Record<MediaItem["type"], [CreditKey, string | null][]> = {
    movie: [
      ["director", text(m.director)],
      ["cast", list(m.cast, 5)],
    ],
    tv: [
      ["seasons", count(m.seasons)],
      ["cast", list(m.cast, 5)],
    ],
    anime: [["studio", text(m.studio)]],
    manga: [["authors", list(m.authors, 3)]],
    book: [
      ["authors", list(m.authors, 3)],
      ["publisher", text(m.publisher)],
    ],
    game: [
      ["developers", list(m.developers, 3)],
      ["platforms", list(m.platforms, 8)],
    ],
    comic: [],
  };
  return (byType[item.type] ?? [])
    .filter((entry): entry is [CreditKey, string] => Boolean(entry[1]))
    .map(([key, value]) => ({ key, value }));
}

const sectionTitle = "font-display text-xl font-bold text-text-primary mb-3";
const crumbLink =
  "inline-flex items-center min-h-11 rounded-[4px] hover:text-accent-pink transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink";

export async function MediaDetail({
  item,
  genreLabels,
  trailerKey,
  providers,
  watchLink,
  initialEntry,
  isAuthenticated,
  matchScore,
  steam,
  source,
  kulturaRating,
  breadcrumbs = [],
  adaptations,
  shareRating,
}: MediaDetailProps) {
  const t = await getTranslations("media_detail");
  const tMedia = await getTranslations("media");
  const locale = await getLocale();
  const extraDetail = getExtraDetailValue(item);
  const typeLabel = tMedia(item.type as Parameters<typeof tMedia>[0]);
  const genres = genreLabels ?? item.genres ?? [];
  const credits = getCredits(item);

  const tiles: DetailTile[] = [];
  if (item.year) {
    tiles.push({ key: "year", icon: IconCalendar, label: t("year"), value: String(item.year) });
  }
  tiles.push({ key: "type", icon: IconFormat, label: t("type"), value: typeLabel });
  // Notas aparte de los datos y cada una con su escala (revisión del PR #40):
  // la de KULTURA es 1-5 y la del proveedor 0-10; juntas y sin escala
  // parecían la misma cosa.
  const decimal = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const ratings: { key: string; label: string; srLabel?: string; value: string; hint?: string }[] = [];
  if (kulturaRating) {
    ratings.push({
      key: "kultura",
      label: t("kulturaRatingLabel"),
      value: `${decimal.format(kulturaRating.value)}/5`,
      hint: t("kulturaRatingHint", { count: kulturaRating.count }),
    });
  }
  if (item.rating !== undefined && item.ratingSource) {
    ratings.push({
      key: "provider",
      label: item.ratingSource,
      srLabel: t("providerRatingLabel", { source: item.ratingSource }),
      value: `${decimal.format(item.rating)}/10`,
    });
  }
  if (extraDetail) {
    tiles.push({
      key: extraDetail.key,
      icon: extraDetail.key === "duration" ? IconClock : IconLayers,
      label: t(extraDetail.key),
      value:
        extraDetail.key === "duration"
          ? t("durationValue", { minutes: extraDetail.value })
          : String(extraDetail.value),
    });
  }

  // "Por qué te lo recomendamos" — nunca texto de IA fabricado: se construye
  // con datos reales de esta página (los géneros del item) y se oculta si no
  // hay señal: `matchScore` es la compuerta que dice que SÍ hay afinidad
  // calculada para este usuario, aunque su valor ya no se enseñe.
  const topGenres = genres.slice(0, 3);
  const showWhyRecommended = matchScore !== undefined && topGenres.length > 0;

  // Vuelta a esta ficha tras registrarse o entrar (D-01, CTA sin sesión).
  const selfPath = mediaPath(locale, item.type, item.externalId);
  const next = encodeURIComponent(selfPath);

  return (
    <main id="main" className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 md:px-14 pt-1 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-14">
        {breadcrumbs.length > 0 && (
          <nav aria-label={t("breadcrumbLabel")} className="mb-2">
            <ol className="flex flex-wrap items-center gap-x-1.5 text-xs text-text-tertiary">
              {breadcrumbs.map((c) => (
                <li key={c.href} className="inline-flex items-center gap-1.5">
                  <Link href={c.href} className={crumbLink}>
                    {c.name}
                  </Link>
                  <span aria-hidden="true">›</span>
                </li>
              ))}
              <li className="inline-flex items-center min-h-11 min-w-0">
                <span aria-current="page" className="text-text-secondary line-clamp-1">
                  {item.title}
                </span>
              </li>
            </ol>
          </nav>
        )}

        <div className="flex flex-col md:flex-row gap-8 md:gap-14">
          {/* ── Columna izquierda: poster ── */}
          <div className="w-full md:w-[420px] flex-shrink-0">
            <div className="relative">
              <div
                className="relative w-full h-[260px] sm:h-auto sm:aspect-[3/4] rounded-[32px] overflow-hidden flex items-end p-6 md:p-8"
                style={{ boxShadow: "12px 12px 0 oklch(26% 0.025 280)" }}
              >
                {/* Gradiente SIEMPRE detrás (E-CARD-PORTADA-404): con
                    `poster ? imagen : gradiente`, una portada que da 404
                    dejaba la ficha con un hueco del color de fondo. */}
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ background: posterGradient(item.id) }}
                >
                  {!item.poster && (
                    <span aria-hidden="true" className="text-white/90 font-display font-extrabold text-3xl">
                      {item.title.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                {item.poster && (
                  <PosterImage
                    src={item.poster}
                    sizes="(max-width: 768px) 90vw, 420px"
                    className="object-cover object-[center_25%] sm:object-center"
                    priority
                  />
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

            {/* Chips: año / tipo / duración o episodios (DISENO.md — chip inactivo).
                La etiqueta va como texto para lector (un `aria-label` en un
                <span> sin rol no se anuncia). */}
            {tiles.length > 0 && (
              <ul className="flex flex-wrap gap-2 mt-4">
                {tiles.map(({ key, icon: Icon, label, value, hint }) => (
                  <li
                    key={key}
                    className="inline-flex items-center gap-1.5 rounded-full bg-surface-elevated text-text-primary font-bold text-xs px-4 py-2"
                  >
                    <Icon className="w-3.5 h-3.5 text-text-tertiary" />
                    <span className="sr-only">{label}: </span>
                    {value}
                    {hint && <span className="text-text-tertiary font-medium">{hint}</span>}
                  </li>
                ))}
              </ul>
            )}

            {/* Notas: KULTURA (1-5) y proveedor (0-10), con su etiqueta visible. */}
            {ratings.length > 0 && (
              <ul aria-label={t("ratingsLabel")} className="flex flex-wrap gap-2 mt-2">
                {ratings.map(({ key, label, srLabel, value, hint }) => (
                  <li
                    key={key}
                    className="inline-flex items-center gap-1.5 rounded-full bg-surface-elevated text-text-primary text-xs px-4 py-2"
                  >
                    <IconStar
                      className={`w-3.5 h-3.5 ${key === "kultura" ? "text-accent-highlight" : "text-text-tertiary"}`}
                    />
                    {srLabel ? (
                      <>
                        <span className="sr-only">{srLabel}: </span>
                        <span aria-hidden="true" className="font-medium text-text-secondary">
                          {label}
                        </span>
                      </>
                    ) : (
                      <span className="font-medium text-text-secondary">{label}</span>
                    )}
                    <span className="font-bold">{value}</span>
                    {hint && <span className="text-text-tertiary font-medium">· {hint}</span>}
                  </li>
                ))}
              </ul>
            )}

            {/* Géneros — chip "outline" (DISENO.md) */}
            {genres.length > 0 && (
              <ul aria-label={t("genres")} className="flex flex-wrap gap-2 mt-2.5">
                {genres.slice(0, 5).map((g) => (
                  <li
                    key={g}
                    className="rounded-full border-2 border-surface-border text-text-secondary font-bold text-xs px-3.5 py-1.5"
                  >
                    {g}
                  </li>
                ))}
              </ul>
            )}

            {/* CTAs — primario "+ Añadir a mi biblioteca" / secundarios */}
            <div className="flex flex-col gap-2.5 mt-6">
              {isAuthenticated ? (
                <>
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
                    isAuthenticated
                  />
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <AddToListButton item={item} />
                    <RecommendButton item={item} />
                  </div>
                  {shareRating && (
                    <ShareRatingButton path={shareRating.path} title={item.title} rating={shareRating.rating} />
                  )}
                  <ReportButton targetType="media" targetId={item.id} />
                </>
              ) : (
                <>
                  <KButton asChild variant="primary" size="lg">
                    <Link href={`/login?mode=register&next=${next}`} rel="nofollow">
                      <span aria-hidden="true">+</span> {t("ctaAdd")}
                    </Link>
                  </KButton>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {t("ctaHint")}{" "}
                    <Link
                      href={`/login?mode=login&next=${next}`}
                      rel="nofollow"
                      className="whitespace-nowrap font-bold text-text-primary underline underline-offset-2 hover:text-accent-pink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink rounded-[4px]"
                    >
                      {t("ctaLogin")}
                    </Link>
                  </p>
                  <KButton asChild variant="secondary" size="sm" className="self-start text-xs text-text-tertiary">
                    <Link href={`/report?target=media&id=${encodeURIComponent(item.id)}`} rel="nofollow">
                      {t("reportPublic")}
                    </Link>
                  </KButton>
                </>
              )}
            </div>
          </div>

          {/* ── Columna derecha: info ── */}
          <div className="flex-1 min-w-0 pt-1 md:pt-2 space-y-8">
            {/* Por qué te lo recomendamos — solo con señal real (ver arriba) */}
            {showWhyRecommended && (
              <section>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-elevated text-text-primary font-bold text-xs px-4 py-2 mb-3">
                  <span aria-hidden="true">🤖</span> {t("whyRecommended")}
                </span>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {t("whyRecommendedText", { genres: topGenres.join(", ") })}
                </p>
              </section>
            )}

            {/* Sinopsis */}
            {item.synopsis && (
              <section>
                <h2 className={sectionTitle}>{t("synopsis")}</h2>
                {/* E-SINOPSIS-I18N: AniList, RAWG y ComicVine solo publican
                    inglés. La traducción se resuelve fuera del render crítico
                    — el fallback es el texto original, así que la ficha nunca
                    espera y nunca se queda sin sinopsis. Sin sesión solo se
                    usa una traducción ya hecha (tope de IA, D-06). */}
                <Suspense
                  fallback={<SynopsisSection text={item.synopsis} lang={synopsisLang(item.synopsis, locale)} />}
                >
                  <TranslatedSynopsis
                    text={item.synopsis}
                    mediaId={item.id}
                    cacheOnly={!isAuthenticated}
                  />
                </Suspense>
              </section>
            )}

            {/* Ficha técnica */}
            {credits.length > 0 && (
              <section>
                <h2 className={sectionTitle}>{t("details")}</h2>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  {credits.map(({ key, value }) => (
                    <div key={key} className="contents">
                      <dt className="text-text-tertiary font-bold">{t(`credits.${key}`)}</dt>
                      <dd className="text-text-secondary min-w-0">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {/* También existe como… (F-29): se pinta cuando llega, sin hueco si no hay. */}
            {adaptations}

            {/* Steam (solo juegos, y solo si se resolvió la ficha de tienda) */}
            {steam && <SteamSection steam={steam} />}

            {/* Dónde ver: suscripción, alquiler y compra (PRO-2, PRO-6) */}
            {providers && providers.length > 0 && (
              <StreamingProviders providers={providers} title={t("whereToWatch")} link={watchLink} />
            )}

            {/* Tráiler */}
            {trailerKey && (
              <section>
                <h2 className={sectionTitle}>{t("trailer")}</h2>
                <TrailerEmbed youtubeKey={trailerKey} title={t("trailerTitle", { title: item.title })} />
              </section>
            )}

            {/* Fuente de los datos: enlace activo a la página del título en su
                proveedor (RAWG lo exige en cada página con sus datos). */}
            {source && (
              <p className="text-xs text-text-tertiary leading-relaxed">
                {t("sourceLabel")}{" "}
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("sourceLinkLabel", { name: source.name })}
                  className={SOURCE_LINK_CLASS}
                >
                  {source.name}
                </a>
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
