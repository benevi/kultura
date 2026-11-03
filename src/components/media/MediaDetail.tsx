// ============================================================
// KULTURA — MediaDetail: la ficha, «el reverso del cromo» (DISENO.md)
//
// El cromo en grande es lo que manda (anverso, `TitleCromo`): su forma dice
// tu estado (sostenido sobre su hueco si no lo tienes o está pendiente,
// puesto con la tira de progreso si va en curso, pegado si lo acabaste, con
// la esquina doblada si lo dejaste) y se pega al cambiarlo. Al lado, el
// reverso: título en Lilita, formato, año, notas reales con su fuente y su
// escala, tus acciones y, debajo, dónde verlo en España, sinopsis, tu
// diario, detalles, adaptaciones (como cromos), Steam y tráiler.
//
// En el móvil: título arriba, cromo y datos lado a lado, y la acción
// principal dentro de la primera pantalla. En escritorio, el cromo a la
// izquierda y quieto mientras se lee el reverso. Sin degradados ni velos
// encima de la portada: el título va fuera de ella.
//
// Es PÚBLICA (D-01): sin sesión, el CTA principal lleva al registro con
// `next` de vuelta aquí y la denuncia va al formulario sin cuenta de
// `/report`; con sesión, biblioteca, listas, recomendar y denunciar.
// Server Component async.
// ============================================================

import { Suspense, type ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import type { MediaItem, StreamingProvider } from "@/types/media";
import type { DiaryLog, LibraryEntry, RatingScale } from "@/types/library";
import type { SteamInfo } from "@/lib/api/steam";
import type { SourceLink } from "@/lib/media/source-link";
import type { KulturaRating } from "@/lib/media/kultura-rating";
import { mediaPath } from "@/lib/media/seo";
import { synopsisLang } from "@/lib/media/synopsis-lang";
import { formatScore } from "@/lib/design/format";
import { Link } from "@/i18n/navigation";
import { KButton } from "@/components/ui/KButton";
import { IconChevronRight } from "@/components/icons";
import { FormatTag } from "@/components/album/FormatTag";
import { SOURCE_LINK_CLASS } from "@/components/legal/DataAttribution";
import { TitleEntryProvider } from "@/components/library/entry-context";
import { TitleCromo } from "@/components/library/TitleCromo";
import { TitleDiary } from "@/components/library/TitleDiary";
import type { DisplayScale } from "@/components/library/rating-display";
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
  /** F-24: tu escala y tus apuntes de ESTE título (con la cuenta abierta y la migración). */
  diary?: { scale: RatingScale; logs: DiaryLog[] } | null;
  /** Escala de tu nota sin diario (`legacy`: estrellas enteras). */
  ratingScale?: DisplayScale;
  /** `?guardar=1`: con la cuenta abierta y sin el título, se guarda como pendiente al llegar. */
  autoSave?: boolean;
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

/** El mismo título de sección en todo el reverso (Lilita a 24 px). */
export const SECTION_TITLE = "mb-3 font-display text-2xl text-text-primary";
const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";
const crumbLink = `inline-flex min-h-11 items-center rounded-lg underline-offset-2 hover:text-text-primary hover:underline transition-colors ${FOCUS}`;

/**
 * Tamaño del titular: hasta 3 líneas en el móvil (DISENO.md). Un título largo
 * baja un escalón en vez de cortarse (WIG: nada de `line-clamp` en el h1).
 */
function headlineSize(title: string): string {
  return title.length > 48 ? "text-2xl md:text-4xl" : "text-3xl md:text-5xl";
}

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
  diary = null,
  ratingScale = "legacy",
  autoSave = false,
}: MediaDetailProps) {
  const t = await getTranslations("media_detail");
  const tAlbum = await getTranslations("album");
  // La misma frase que la recomendación de Inicio: un solo texto que mantener.
  const tAi = await getTranslations("aiRecommendations");
  const locale = await getLocale();
  const extraDetail = getExtraDetailValue(item);
  const formatLabel = tAlbum(`format.${item.type}` as Parameters<typeof tAlbum>[0]);
  const genres = genreLabels ?? item.genres ?? [];
  const credits = getCredits(item);

  // Datos del título (año, duración…), con su nombre para el lector.
  const facts: { key: string; label: string; value: string }[] = [];
  if (item.year) facts.push({ key: "year", label: t("year"), value: String(item.year) });
  if (extraDetail) {
    facts.push({
      key: extraDetail.key,
      label: t(extraDetail.key),
      value:
        extraDetail.key === "duration"
          ? t("durationValue", { minutes: extraDetail.value })
          : t("countValue", { count: extraDetail.value, kind: extraDetail.key }),
    });
  }

  // Notas aparte de los datos y cada una con su escala (revisión del PR #40):
  // la de KULTURA es 1-5 y la del proveedor 0-10; juntas y sin escala
  // parecían la misma cosa. La cifra va en Lilita (la nota grande).
  const ratings: { key: string; label: string; srLabel?: string; value: string; scale: string; hint?: string }[] = [];
  if (kulturaRating) {
    ratings.push({
      key: "kultura",
      label: t("kulturaRatingLabel"),
      value: formatScore(kulturaRating.value, locale),
      scale: "/5",
      hint: t("kulturaRatingHint", { count: kulturaRating.count }),
    });
  }
  if (item.rating !== undefined && item.ratingSource) {
    ratings.push({
      key: "provider",
      label: item.ratingSource,
      srLabel: t("providerRatingLabel", { source: item.ratingSource }),
      value: formatScore(item.rating, locale),
      scale: "/10",
    });
  }

  // "Por qué te lo recomendamos" — nunca texto de IA fabricado: se construye
  // con datos reales de esta página (los géneros del item) y se oculta si no
  // hay señal: `matchScore` es la compuerta que dice que SÍ hay afinidad
  // calculada para este usuario, aunque su valor ya no se enseñe.
  const topGenres = genres.slice(0, 3);
  const showWhyRecommended = matchScore !== undefined && topGenres.length > 0;

  // Vuelta a esta ficha tras registrarse o entrar (D-01, CTA sin sesión).
  // Tras crear la cuenta, «Añadir a mi biblioteca» se cumple solo
  // (`?guardar=1`: pendiente, y nunca pisa una entrada que ya exista).
  const selfPath = mediaPath(locale, item.type, item.externalId);
  const next = encodeURIComponent(selfPath);
  const nextSave = encodeURIComponent(`${selfPath}?guardar=1`);
  const scale: DisplayScale = diary?.scale ?? ratingScale;

  return (
    <main id="main" className="min-h-screen">
      <div className="page-grid pt-1 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-14">
        {breadcrumbs.length > 0 ? (
          <nav aria-label={t("breadcrumbLabel")} className="mb-1">
            <ol className="flex flex-wrap items-center gap-x-1.5 text-xs text-text-tertiary">
              {breadcrumbs.map((c) => (
                <li key={c.href} className="inline-flex items-center gap-1.5">
                  <Link href={c.href} className={crumbLink}>
                    {c.name}
                  </Link>
                  <IconChevronRight aria-hidden="true" className="h-3 w-3" />
                </li>
              ))}
              <li className="inline-flex min-h-11 min-w-0 items-center">
                <span aria-current="page" className="line-clamp-1 text-text-secondary">
                  {item.title}
                </span>
              </li>
            </ol>
          </nav>
        ) : null}

        <TitleEntryProvider initialEntry={initialEntry} initialLogs={diary?.logs ?? null} scale={scale}>
          <article
            data-ficha=""
            className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:grid-rows-[auto_auto_auto_1fr] md:gap-x-12 md:gap-y-6"
          >
            {/* ── Título: arriba en el móvil, junto al cromo en escritorio ── */}
            <header data-ficha-title="" className="col-span-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1">
              <h1 className={`break-words font-display text-balance text-text-primary hyphens-auto ${headlineSize(item.title)}`}>
                {item.title}
              </h1>
              {item.originalTitle && item.originalTitle !== item.title ? (
                <p className="mt-1 break-words text-sm text-text-tertiary">{item.originalTitle}</p>
              ) : null}
            </header>

            {/* ── El anverso: el cromo, lo que manda ── */}
            <div
              data-ficha-cromo=""
              className="col-start-1 row-start-2 self-start md:row-span-4 md:row-start-1 md:sticky md:top-20"
            >
              <TitleCromo
                id={item.id}
                type={item.type}
                title={item.title}
                poster={item.poster}
                initialEntry={initialEntry}
                labels={{ folded: tAlbum("folded"), foil: tAlbum("foil") }}
                sizes="(max-width: 768px) 50vw, 440px"
                priority
              />
            </div>

            {/* ── Datos: formato, año, duración, notas y géneros ── */}
            <div data-ficha-facts="" className="col-start-2 row-start-2 flex min-w-0 flex-col gap-4 md:row-start-2">
              <ul className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-text-secondary">
                <li>
                  <FormatTag format={item.type} label={formatLabel} className="text-sm" />
                </li>
                {facts.map(({ key, label, value }) => (
                  <li key={key} className="tabular-nums">
                    <span className="sr-only">{label}: </span>
                    {value}
                  </li>
                ))}
              </ul>

              {ratings.length > 0 ? (
                <ul aria-label={t("ratingsLabel")} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-8">
                  {ratings.map(({ key, label, srLabel, value, scale: max, hint }) => (
                    <li key={key} className="flex flex-col">
                      <span className="flex items-baseline gap-0.5">
                        {srLabel ? <span className="sr-only">{srLabel}: </span> : null}
                        <span className="font-display text-4xl leading-none tabular-nums text-text-primary">{value}</span>
                        <span className="text-meta font-semibold text-text-tertiary">{max}</span>
                      </span>
                      <span className="mt-1 text-xs text-text-tertiary">
                        {srLabel ? (
                          <span aria-hidden="true" className="font-semibold text-text-secondary">
                            {label}
                          </span>
                        ) : (
                          <span className="font-semibold text-text-secondary">{label}</span>
                        )}
                        {hint ? <span> · {hint}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {genres.length > 0 ? (
                <ul aria-label={t("genres")} className="flex flex-wrap gap-1.5">
                  {genres.slice(0, 5).map((g) => (
                    <li
                      key={g}
                      className="rounded-full border-2 border-surface-border px-2.5 py-0.5 text-xs font-semibold text-text-secondary"
                    >
                      {g}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {/* ── Tus acciones: una sola acción rosa por pantalla ── */}
            <div data-ficha-actions="" className="col-span-2 flex flex-col gap-3 md:col-span-1 md:col-start-2 md:row-start-3">
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
                    initialDiary={diary}
                    scale={scale}
                    autoSave={autoSave}
                  />
                  <div className="flex flex-wrap items-center gap-2.5">
                    <AddToListButton item={item} />
                    <RecommendButton item={item} />
                    {shareRating ? (
                      <ShareRatingButton path={shareRating.path} title={item.title} rating={shareRating.rating} />
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <KButton asChild variant="primary" size="lg" className="w-full sm:w-auto sm:self-start">
                    <Link href={`/login?mode=register&next=${nextSave}`} rel="nofollow">
                      <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round">
                        <path d="M8 3v10M3 8h10" />
                      </svg>
                      {t("ctaAdd")}
                    </Link>
                  </KButton>
                  <p className="text-meta leading-relaxed text-text-secondary">
                    {t("ctaHint")}{" "}
                    <Link
                      href={`/login?mode=login&next=${next}`}
                      rel="nofollow"
                      className={`whitespace-nowrap rounded-lg font-bold text-text-primary underline underline-offset-2 ${FOCUS}`}
                    >
                      {t("ctaLogin")}
                    </Link>
                  </p>
                </>
              )}
            </div>

            {/* ── El reverso: lo que se lee ── */}
            <div data-ficha-body="" className="col-span-2 min-w-0 space-y-10 pt-2 md:col-span-1 md:col-start-2 md:row-start-4">
              {/* Dónde ver: suscripción, alquiler y compra (PRO-2, PRO-6) */}
              {providers && providers.length > 0 ? (
                <StreamingProviders providers={providers} title={t("whereToWatch")} link={watchLink} />
              ) : null}

              {/* Sinopsis */}
              {item.synopsis ? (
                <section aria-labelledby="ficha-synopsis">
                  <h2 id="ficha-synopsis" className={SECTION_TITLE}>
                    {t("synopsis")}
                  </h2>
                  {/* E-SINOPSIS-I18N: AniList, RAWG y ComicVine solo publican
                      inglés. La traducción se resuelve fuera del render crítico
                      — el fallback es el texto original, así que la ficha nunca
                      espera y nunca se queda sin sinopsis. Sin cuenta abierta solo se
                      usa una traducción ya hecha (tope de IA, D-06). */}
                  <Suspense
                    fallback={<SynopsisSection text={item.synopsis} lang={synopsisLang(item.synopsis, locale)} />}
                  >
                    <TranslatedSynopsis text={item.synopsis} mediaId={item.id} cacheOnly={!isAuthenticated} />
                  </Suspense>
                </section>
              ) : null}

              {/* Por qué te lo recomendamos — solo con señal real (ver arriba) */}
              {showWhyRecommended ? (
                <section aria-labelledby="ficha-why">
                  <h2 id="ficha-why" className={SECTION_TITLE}>
                    {t("whyRecommended")}
                  </h2>
                  <p className="max-w-prose text-sm leading-relaxed text-text-secondary">
                    {tAi("whyRecommendedText", { genres: topGenres.join(", ") })}
                  </p>
                </section>
              ) : null}

              {/* Tu diario de este título (con la cuenta abierta) */}
              {isAuthenticated ? <TitleDiary title={item.title} headingClassName={SECTION_TITLE} /> : null}

              {/* Ficha técnica */}
              {credits.length > 0 ? (
                <section aria-labelledby="ficha-details">
                  <h2 id="ficha-details" className={SECTION_TITLE}>
                    {t("details")}
                  </h2>
                  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                    {credits.map(({ key, value }) => (
                      <div key={key} className="contents">
                        <dt className="font-semibold text-text-tertiary">{t(`credits.${key}`)}</dt>
                        <dd className="min-w-0 break-words text-text-secondary">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ) : null}

              {/* También existe como… (F-29): se pinta cuando llega, sin hueco si no hay. */}
              {adaptations}

              {/* Steam (solo juegos, y solo si se resolvió la ficha de tienda) */}
              {steam ? <SteamSection steam={steam} /> : null}

              {/* Tráiler */}
              {trailerKey ? (
                <section aria-labelledby="ficha-trailer">
                  <h2 id="ficha-trailer" className={SECTION_TITLE}>
                    {t("trailer")}
                  </h2>
                  <TrailerEmbed youtubeKey={trailerKey} title={t("trailerTitle", { title: item.title })} />
                </section>
              ) : null}

              {/* Pie del reverso: fuente de los datos (RAWG la exige en cada
                  página con sus datos) y denunciar. */}
              <footer className="flex flex-col items-start gap-2 border-t-2 border-surface-border pt-4">
                {source ? (
                  <p className="text-xs leading-relaxed text-text-tertiary">
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
                ) : null}
                {isAuthenticated ? (
                  <ReportButton targetType="media" targetId={item.id} />
                ) : (
                  <Link
                    href={`/report?target=media&id=${encodeURIComponent(item.id)}`}
                    rel="nofollow"
                    className={`inline-flex min-h-11 items-center rounded-lg text-xs font-semibold text-text-tertiary underline underline-offset-2 hover:text-text-primary ${FOCUS}`}
                  >
                    {t("reportPublic")}
                  </Link>
                )}
              </footer>
            </div>
          </article>
        </TitleEntryProvider>
      </div>
    </main>
  );
}
