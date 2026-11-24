// ============================================================
// KULTURA — MediaDetail (F0)
// Ficha de detalle de un título cultural. Layout de dos columnas
// tal y como se diseñó a mano en el canvas F0 ("Kultura Editorial"):
// poster grande + chips + CTAs a la izquierda, sinopsis, ficha
// técnica, "Dónde ver" y tráiler a la derecha. El sistema de diseño es la fuente
// de verdad del sistema visual. Server Component async.
//
// Es PÚBLICA (D-01): sin sesión, el CTA principal lleva al registro con
// `next` de vuelta aquí y la denuncia va al formulario sin cuenta de
// `/report`; con sesión, biblioteca, listas, recomendar y denunciar.
// ============================================================

import { PosterImage } from "@/components/media/PosterImage";
import { posterGradientFeature } from "@/lib/images/poster-gradient";
import { Suspense, type ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import type { MediaItem, StreamingProvider } from "@/types/media";
import type { LibraryEntry } from "@/types/library";
import type { SteamInfo } from "@/lib/api/steam";
import type { SourceLink } from "@/lib/media/source-link";
import { googleBooksUrl, googleBooksVolumeId } from "@/lib/media/google-books";
import type { KulturaRating } from "@/lib/media/kultura-rating";
import { mediaPath } from "@/lib/media/seo";
import { synopsisLang } from "@/lib/media/synopsis-lang";
import { languageName, originalTitleFact, originalTitleOf } from "@/lib/media/original-title";
import { Link } from "@/i18n/navigation";
import { KButton } from "@/components/ui/KButton";
import { IconSparkles } from "@/components/icons";
import { SOURCE_LINK_CLASS } from "@/components/legal/DataAttribution";
import { TrailerEmbed } from "./TrailerEmbed";
import { StreamingProviders } from "./StreamingProviders";
import { GoogleBooksAttribution } from "./GoogleBooksAttribution";
import { SynopsisSection } from "./SynopsisSection";
import { TranslatedSynopsis } from "./TranslatedSynopsis";
import { SteamSection } from "./SteamSection";
import { ShareRatingButton } from "./ShareRatingButton";
import { LibraryAction } from "@/components/library/LibraryAction";
import { RecommendButton } from "@/components/social/RecommendButton";
import { AddToListButton } from "@/components/social/AddToListButton";
import { ReportButton } from "@/components/social/ReportButton";
import { SalaFicha } from "./sala/SalaFicha";
import { SalaFichaBody, type SalaFichaFact } from "./sala/SalaFichaBody";
import { salaFichaLayout, salaFichaWideImage } from "./sala/SalaFichaHero";
import { salaItemOf, type SalaFichaExtras } from "@/lib/media/sala-item";
import { SalaTrailerLazy as SalaTrailer } from "./sala/SalaTrailerLazy";
import { youtubeTrailerKey } from "@/lib/media/trailer";
import { SalaLibraryActionLazy as SalaLibraryAction, SalaLibraryCtaLazy as SalaLibraryCta } from "@/components/library/sala/SalaLibraryLazy";
import { SalaLink } from "@/components/sala/SalaLink";
import { SalaFichaSection } from "./sala/SalaFichaSection";
import { SalaWhereToWatch } from "./sala/SalaWhereToWatch";
import { SalaSteam } from "./sala/SalaSteam";
import { SalaFichaSources } from "./sala/SalaFichaSources";
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
   * Solo en la ficha de hoy: con «Sala» no hay adaptaciones (F2c).
   */
  adaptations?: ReactNode;
  /**
   * CRE-8a: enlace firmado y nota del usuario con sesión que ya ha puntuado
   * este título ("Compartir mi nota"). Solo para el dueño de la nota.
   */
  shareRating?: { path: string; rating: string } | null;
  /**
   * Fase 8.5 (bandera `SALA_FICHA`, la lee la página): la sala de «Sala»
   * arriba del todo, con el único `h1` (F1), y debajo la franja de datos y la
   * ficha con sinopsis y créditos (F2a), y el resto en «Sala» (F2c): las
   * acciones, «Dónde ver», Steam y las fuentes, sin adaptaciones. El tráiler
   * sigue debajo, como hoy. Sin ella, la ficha de siempre, sin un solo cambio.
   */
  sala?: boolean;
  /**
   * Fase 8.5, F5: lo que la sala añade (la apaisada sin rótulo de TMDB). Solo
   * se usa con `sala`; la imagen para compartir y la biblioteca siguen con
   * `item.backdrop`.
   */
  salaExtras?: SalaFichaExtras | null;
}

interface DetailTile {
  key: string;
  icon: KIcon;
  label: string;
  value: string;
  hint?: string;
}

type ExtraKey = "duration" | "episodes" | "chapters" | "pages";

function positiveNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

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
  "inline-flex items-center min-h-11 rounded-lg hover:text-accent-pink transition-colors " +
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
  sala = false,
  salaExtras,
}: MediaDetailProps) {
  const t = await getTranslations("media_detail");
  const tMedia = await getTranslations("media");
  // La misma frase que la recomendación de Inicio: un solo texto que mantener.
  const tAi = await getTranslations("aiRecommendations");
  const tCommon = await getTranslations("common");
  const locale = await getLocale();
  const extraDetail = getExtraDetailValue(item);
  const googleVolumeId = googleBooksVolumeId(item);
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

  // ── Con «Sala» (F2a): franja, sinopsis y créditos van arriba, en la sala ──
  // F2b (decisión de Víctor): el cuerpo de «Sala» no lleva póster, como el
  // prototipo; las acciones de biblioteca van también arriba, en la sala.
  // F2c: el resto de la ficha pasa también a «Sala»; F3, el tráiler.
  const libraryMediaCache = {
    externalId: item.externalId,
    type: item.type,
    title: item.title,
    poster: item.poster,
    backdrop: item.backdrop,
    year: item.year,
    synopsis: item.synopsis,
    genres: item.genres,
  };
  const salaActions = !sala ? null : isAuthenticated ? (
    <SalaLibraryAction
      mediaId={item.id}
      mediaCache={libraryMediaCache}
      initialEntry={initialEntry}
      toastLabels={{ region: t("salaToastRegion"), dismiss: t("salaToastDismiss"), hint: t("salaToastHint") }}
    />
  ) : (
    <SalaLibraryCta
      registerHref={`/login?mode=register&next=${next}`}
      loginHref={`/login?mode=login&next=${next}`}
      addLabel={t("ctaAdd")}
      hint={t("ctaHint")}
      loginLabel={t("ctaLogin")}
    />
  );
  // F3: el tráiler va en el cuerpo de «Sala», con la imagen de la obra de fondo
  // (nada de YouTube antes de pulsar). Una clave que no vale no pinta la sección.
  const salaTrailerKey = sala ? youtubeTrailerKey(trailerKey) : null;
  // F5: la sala pinta la obra con su apaisada sin rótulo, si la hay.
  const salaItem = salaItemOf(item, sala ? salaExtras : null);
  const salaWide = sala ? salaFichaWideImage(salaItem) : undefined;
  const salaTrailerImage = salaWide
    ? { src: salaWide, wide: true }
    : item.poster
      ? { src: item.poster, wide: false }
      : null;
  const salaMore = !sala ? null : (
    <>
      {/* Las demás acciones: listas, recomendar, compartir la nota y denunciar. */}
      <SalaFichaSection
        id="sala-ficha-more-actions"
        heading={t("salaMoreActionsLabel")}
        hiddenHeading
        data-sala-ficha-more-actions=""
      >
        <div className="flex flex-wrap items-start gap-3">
          {isAuthenticated ? (
            <>
              <AddToListButton item={item} skin="sala" />
              <RecommendButton item={item} skin="sala" />
              {shareRating && (
                <ShareRatingButton path={shareRating.path} title={item.title} rating={shareRating.rating} skin="sala" />
              )}
              <ReportButton targetType="media" targetId={item.id} skin="sala" closeLabel={tCommon("close")} />
            </>
          ) : (
            <SalaLink href={`/report?target=media&id=${encodeURIComponent(item.id)}`} variant="standalone" rel="nofollow">
              {t("reportPublic")}
            </SalaLink>
          )}
        </div>
      </SalaFichaSection>

      {/* Por qué te lo recomendamos — solo con señal real (ver arriba) */}
      {showWhyRecommended && (
        <SalaFichaSection id="sala-ficha-why" heading={t("whyRecommended")}>
          <p className="sala-type-text max-w-prose">{tAi("whyRecommendedText", { genres: topGenres.join(", ") })}</p>
        </SalaFichaSection>
      )}

      {providers && providers.length > 0 && (
        <SalaWhereToWatch providers={providers} title={t("whereToWatch")} link={watchLink} />
      )}

      {steam && <SalaSteam steam={steam} />}

      {/* Sin «También existe como…» con «Sala» (decisión de Víctor, F2c). */}

      {/* El tráiler, al final (F3); debajo solo la cita de las fuentes. */}
      {salaTrailerKey && (
        <SalaFichaSection id="sala-ficha-trailer" heading={t("trailer")} data-sala-ficha-trailer="">
          <SalaTrailer youtubeKey={salaTrailerKey} title={item.title} image={salaTrailerImage} />
        </SalaFichaSection>
      )}

      <SalaFichaSources source={source} googleBooksHref={googleVolumeId ? googleBooksUrl(googleVolumeId) : null} />
    </>
  );
  // F4: el título original con su idioma («Sen to Chihiro no Kamikakushi · japonés»), marcado con `lang`.
  // Si es el mismo que ya va bajo el rótulo de la sala, no se repite: solo
  // «Idioma original: japonés» (decisión de Víctor).
  function salaOriginalFact(): SalaFichaFact[] {
    const original = originalTitleFact(item);
    if (!original) return [];
    const name = languageName(original.lang, locale);
    if (original.text === originalTitleOf(item)?.text) {
      return name ? [{ key: "original-language", label: t("originalLanguage"), value: name }] : [];
    }
    return [
      {
        key: "original-title",
        label: t("originalTitle"),
        value: original.text,
        ...(original.lang ? { valueLang: original.lang } : {}),
        ...(name ? { hint: name } : {}),
      },
    ];
  }
  // F4: un anime que es una película (AniList, `format: MOVIE`) tiene su propio
  // formato en la franja y, en vez de «Episodios: 1», lo que dura. Solo con «Sala».
  const animeMovie = sala && item.type === "anime" && item.metadata?.format === "MOVIE";
  const animeMovieMinutes = animeMovie ? positiveNumber(item.metadata?.duration) : null;
  const salaTiles = tiles.map(({ key, label, value }): Pick<DetailTile, "key" | "label" | "value"> => {
    // En la franja, «Formato» (decisión de Víctor); la ficha de hoy sigue con «Tipo».
    if (key === "type") return { key, label: t("format"), value: animeMovie ? t("formatAnimeMovie") : value };
    if (key === "episodes" && animeMovieMinutes) {
      return { key: "duration", label: t("duration"), value: t("durationValue", { minutes: animeMovieMinutes }) };
    }
    return { key, label, value };
  });
  const salaFacts: SalaFichaFact[] = sala
    ? [
        ...salaTiles,
        ...ratings.map(({ key, label, srLabel, value, hint }) => ({ key: `rating-${key}`, label, srLabel, value, hint })),
        ...(genres.length > 0 ? [{ key: "genres", label: t("genres"), value: genres.slice(0, 5).join(", ") }] : []),
        ...salaOriginalFact(),
      ]
    : [];

  return (
    <main id="main" className="min-h-screen">
      {sala && (
        <SalaFicha key={item.id} item={salaItem}>
          <SalaFichaBody
            factsLabel={t("salaFactsLabel")}
            bandWithStage={salaFichaLayout(salaItem) !== "stage"}
            facts={salaFacts}
            synopsisHeading={t("synopsis")}
            synopsis={
              item.synopsis ? (
                <Suspense
                  fallback={
                    <SynopsisSection
                      text={item.synopsis}
                      lang={synopsisLang(item.synopsis, locale)}
                      variant="sala"
                    />
                  }
                >
                  <TranslatedSynopsis
                    text={item.synopsis}
                    mediaId={item.id}
                    cacheOnly={!isAuthenticated}
                    variant="sala"
                  />
                </Suspense>
              ) : null
            }
            actions={salaActions}
            actionsLabel={t("salaLibraryLabel")}
            more={salaMore}
            creditsLabel={t("details")}
            credits={credits.map(({ key, value }) => ({ key, label: t(`credits.${key}`), value }))}
            breadcrumbs={
              breadcrumbs.length > 0
                ? { label: t("breadcrumbLabel"), items: breadcrumbs, current: item.title }
                : null
            }
          />
        </SalaFicha>
      )}
      {sala ? (
        // Con «Sala» todo va en el cuerpo, el tráiler también (F3): aquí solo
        // queda el hueco de la barra de abajo en móvil, como hasta ahora.
        <div aria-hidden="true" className="pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-14" />
      ) : (
      <div className="page-grid pt-1 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-14">
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
            {/* `data-library-stamp`: aquí cuelga el sello «Visto» de
                `LibraryAction` al marcarlo como completado (DIS-14). */}
            <div className="relative" data-library-stamp="">
                <div
                  className="relative w-full h-[260px] sm:h-auto sm:aspect-[3/4] rounded-bento-xl overflow-hidden flex items-end p-6 md:p-8 shadow-hard-sm md:shadow-hard"
                >
                  {/* Gradiente SIEMPRE detrás (E-CARD-PORTADA-404): con
                      `poster ? imagen : gradiente`, una portada que da 404
                      dejaba la ficha con un hueco del color de fondo. */}
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ background: posterGradientFeature(item.id) }}
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

                  <>
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
                  </>
                </div>
              </div>

            {/* Chips: año / tipo / duración o episodios (chip inactivo).
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

            {/* Géneros — chip "outline" */}
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
                    mediaCache={libraryMediaCache}
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
                      className="whitespace-nowrap font-bold text-text-primary underline underline-offset-2 hover:text-accent-pink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink rounded-lg"
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
                  <IconSparkles className="h-4 w-4 text-accent-pink" /> {t("whyRecommended")}
                </span>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {tAi("whyRecommendedText", { genres: topGenres.join(", ") })}
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
            {source && source.name !== "Google Books" && (
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

            {/* Google Books: logo «Powered by Google» y enlace a la página del
                libro, cuando la ficha lleva datos suyos (normas de marca). */}
            {googleVolumeId && (
              <GoogleBooksAttribution
                href={googleBooksUrl(googleVolumeId)}
                label={t("googleBooksLink")}
                linkLabel={t("googleBooksLinkLabel")}
              />
            )}
          </div>
        </div>
      </div>
      )}
    </main>
  );
}
