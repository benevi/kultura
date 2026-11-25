// ============================================================
// KULTURA — Ficha de un título: metadatos y pintado (D-01)
// Lo comparten la ficha de siempre (`app/[locale]/media/[type]/[id]`, con
// sesión) y la cacheable para visitantes sin sesión (bandera `FICHA_ISR`,
// `app/[locale]/media-anonima/[type]/[id]`). Quien mira llega en `viewer`:
// sin sesión no se lee ninguna cookie ni cabecera (lo exige la caché ISR).
// ============================================================

import * as React from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { MediaItem } from "@/types/media";
import { MediaDetail, type Breadcrumb } from "@/components/media/MediaDetail";
import type { Viewer } from "@/lib/media/viewer";
import { createClient } from "@/lib/supabase/server";
import { getMediaEntry } from "@/lib/library/queries";
import { computeMatchScores } from "@/lib/recommendations/match-score";
import { translateSynopsis } from "@/lib/translate/synopsis";
import type { MediaDetailData } from "@/lib/media/detail-data";
import { getKulturaRating } from "@/lib/media/kultura-rating";
import {
  buildMediaJsonLd,
  isIndexable,
  mediaPath,
  metaDescription,
  serializeJsonLd,
} from "@/lib/media/seo";
import { isBestFormat } from "@/lib/best/best-of";
import { formatShareRating, ratingSharePath } from "@/lib/share/rating-share";
import { readRatingScale } from "@/lib/library/scale";
import type { LibraryEntry } from "@/types/library";
import type { User } from "@supabase/supabase-js";
import { OG_LOCALE, SITE_NAME } from "@/i18n/metadata";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site-url";
import type { AppLocale } from "@/i18n/detect";
import { loadSalaFichaExtras } from "@/lib/media/sala-extras";

// `React.cache` existe en el React de servidor de Next; en tests, la función.
const dedupe: <T extends (...args: never[]) => unknown>(fn: T) => T =
  (React as unknown as { cache?: <T>(fn: T) => T }).cache ?? ((fn) => fn);

/**
 * Sinopsis en el idioma de la página SOLO si ya está traducida (sin llamar al
 * modelo): metadatos y JSON-LD van en el camino crítico de la respuesta. Una
 * vez por petición (metadatos y página la comparten).
 */
const cachedSynopsis = dedupe(async (text: string | undefined, mediaId: string, locale: string) =>
  text ? translateSynopsis({ text, locale, mediaId, cacheOnly: true }) : undefined
);

const appLocale = (locale: string): AppLocale => (locale === "en" ? "en" : "es");

function localeUrls(type: MediaItem["type"], externalId: string): Record<string, string> {
  const base = siteUrl();
  const languages = Object.fromEntries(
    routing.locales.map((l) => [l, `${base}${mediaPath(l, type, externalId)}`])
  ) as Record<string, string>;
  return { ...languages, "x-default": languages[routing.defaultLocale] };
}

/** Imagen para compartir: el fondo apaisado si lo hay (tarjeta grande), si no la portada. */
function shareImage(item: MediaItem) {
  if (item.backdrop) {
    const tmdb = item.backdrop.includes("image.tmdb.org/t/p/w1280/");
    return { url: item.backdrop, ...(tmdb ? { width: 1280, height: 720 } : {}), alt: item.title };
  }
  if (item.poster) {
    const tmdb = item.poster.includes("image.tmdb.org/t/p/w500/");
    return { url: item.poster, ...(tmdb ? { width: 500, height: 750 } : {}), alt: item.title };
  }
  return null;
}

/**
 * CRE-8a: "Compartir mi nota" para quien ya ha puntuado este título. El
 * enlace va FIRMADO (es lo que deja ver esa nota a quien no ve su biblioteca)
 * y la nota en SU escala (½★ o /10).
 */
function shareRatingFor(
  user: User | null,
  username: string | undefined,
  entry: LibraryEntry | null,
  item: MediaItem,
  locale: string
): { path: string; rating: string } | null {
  if (!user || !username || !entry) return null;
  const rating = formatShareRating(entry, readRatingScale(user), locale);
  const path = ratingSharePath({ id: user.id, username }, item.type, item.externalId);
  return rating && path ? { path: `/${locale}${path}`, rating: rating.text } : null;
}

// ── Metadata ──────────────────────────────────────────────────────────────────

/** Metadatos de la ficha (`data` null: título que no se pudo cargar). */
export async function fichaMetadata(locale: string, data: MediaDetailData | null): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "media_detail" });
  if (!data) return { title: t("notFound"), robots: { index: false, follow: true } };

  const { item } = data;
  const tMedia = await getTranslations({ locale, namespace: "media" });
  const typeLabel = tMedia(item.type);
  const name = item.year ? `${item.title} (${item.year})` : item.title;
  const synopsis = await cachedSynopsis(item.synopsis, item.id, locale);
  const description =
    metaDescription(synopsis) ?? t("metaFallback", { title: item.title });
  const languages = localeUrls(item.type, item.externalId);
  const url = languages[locale] ?? languages[routing.defaultLocale];
  const image = shareImage(item);
  const ogType =
    item.type === "movie" ? "video.movie" : item.type === "tv" || item.type === "anime" ? "video.tv_show" : "website";

  return {
    title: `${name} · ${typeLabel}`,
    description,
    alternates: { canonical: url, languages },
    robots: isIndexable(item, data.nsfw) ? undefined : { index: false, follow: true },
    openGraph: {
      type: ogType,
      siteName: SITE_NAME,
      locale: OG_LOCALE[appLocale(locale)],
      alternateLocale: routing.locales.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      url,
      title: `${name} · ${SITE_NAME}`,
      description,
      ...(image ? { images: [image] } : {}),
    },
    twitter: {
      // Tarjeta grande solo con el fondo apaisado: una portada vertical (y las
      // de AniList, de ~230 px) se recorta o no llega al mínimo de X.
      card: item.backdrop ? "summary_large_image" : "summary",
      title: `${name} · ${SITE_NAME}`,
      description,
      ...(image ? { images: [image.url] } : {}),
    },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

/**
 * La ficha ya cargada. `viewer` vacío = visitante sin sesión; `sala` dice si
 * se pinta «Sala» (se pide en paralelo con lo demás).
 */
export async function renderFicha({
  locale,
  data,
  viewer,
  sala: salaEnabled,
}: {
  locale: string;
  data: MediaDetailData;
  viewer: Viewer;
  sala: Promise<boolean>;
}) {
  const { item } = data;
  const { user, profile } = viewer;
  const supabase = user ? await createClient() : null;

  const [initialEntry, kulturaRating, matchScores, synopsis, t, tMedia, sala] = await Promise.all([
    user ? getMediaEntry(user.id, item.id).catch(() => null) : Promise.resolve(null),
    getKulturaRating(item.id),
    // Afinidad (F3a) solo como compuerta de "Por qué te lo recomendamos": sin
    // biblioteca suficiente devuelve un Map vacío y no se pinta la sección.
    user && supabase
      ? computeMatchScores(user.id, [item], supabase).catch(() => new Map<string, number>())
      : Promise.resolve(new Map<string, number>()),
    cachedSynopsis(item.synopsis, item.id, locale),
    getTranslations({ locale, namespace: "media_detail" }),
    getTranslations({ locale, namespace: "media" }),
    // Fase 8.5, F1: la sala de «Sala» (bandera SALA_FICHA: 0, prueba o 1).
    salaEnabled,
  ]);

  // Fase 8.5, F5: solo con la sala, la apaisada sin rótulo de TMDB y, en un
  // anime de AniList, el cruce con TMDB por Wikidata (F5c). Con la bandera
  // apagada no se pide nada más y la ficha sale igual que siempre.
  const salaExtras = sala
    ? await loadSalaFichaExtras(item, {
        locale,
        hasTrailer: Boolean(data.trailerKey),
        hasProviders: data.providers.length > 0,
      })
    : null;

  // Miga de pan: la misma en pantalla y en el JSON-LD. El formato enlaza a su
  // ranking del año cuando existe (los hubs `/best/[format]` llegan con F-16).
  const base = siteUrl();
  const url = `${base}${mediaPath(locale, item.type, item.externalId)}`;
  const year = new Date().getFullYear();
  const crumbs: Breadcrumb[] = [{ name: t("breadcrumbHome"), href: "/" }];
  if (isBestFormat(item.type)) {
    crumbs.push({ name: tMedia(`${item.type}s`), href: `/best/${item.type}/${year}` });
  }
  const jsonLd = buildMediaJsonLd({
    item,
    genreLabels: data.genreLabels,
    description: synopsis,
    url,
    locale,
    sameAs: data.source?.url,
    breadcrumbs: [
      ...crumbs.map((c) => ({ name: c.name, url: `${base}/${locale}${c.href === "/" ? "" : c.href}` })),
      { name: item.title, url },
    ],
  });

  return (
    <>
      <MediaDetail
        item={item}
        genreLabels={data.genreLabels}
        trailerKey={data.trailerKey}
        providers={data.providers}
        watchLink={data.watchLink}
        steam={data.steam}
        source={data.source}
        kulturaRating={kulturaRating}
        breadcrumbs={crumbs}
        initialEntry={initialEntry}
        isAuthenticated={Boolean(user)}
        matchScore={matchScores.get(item.id)}
        shareRating={shareRatingFor(user, profile?.username, initialEntry, item, locale)}
        sala={sala}
        salaExtras={salaExtras}
        // Sin «También existe como…» (F-29): Víctor no quiere que se vea
        // (22-11-2026). Se borró la sección y ya no se consulta Wikidata
        // desde la ficha; la carga de datos (src/lib/adaptations) sigue.
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
    </>
  );
}
