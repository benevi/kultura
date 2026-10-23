// ============================================================
// KULTURA — Ficha de un título (PÚBLICA, D-01)
// Ruta: /[locale]/media/[type]/[id]
// Tipos: movie, tv, anime, manga, book, comic, game
//
// Vive FUERA de `(app)`: cualquiera la abre sin cuenta (enlaces de perfiles,
// listas, rankings y buscadores). Con sesión, `media/layout.tsx` pone la
// cabecera y la barra de la app y aquí se añaden biblioteca y afinidad; sin
// sesión, cabecera pública y CTA "Añadir a mi biblioteca" → registro con
// `next` de vuelta a esta ficha.
//
// Datos del proveedor: 24 h en la caché de datos (`loadMediaDetail`). Lo del
// usuario (biblioteca, afinidad) se pide aparte y nunca se cachea.
// ============================================================

import * as React from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { MediaItem } from "@/types/media";
import { MediaDetail, type Breadcrumb } from "@/components/media/MediaDetail";
import { getViewer } from "@/lib/media/viewer";
import { createClient } from "@/lib/supabase/server";
import { getMediaEntry } from "@/lib/library/queries";
import { computeMatchScores } from "@/lib/recommendations/match-score";
import { translateSynopsis } from "@/lib/translate/synopsis";
import { loadMediaDetail } from "@/lib/media/detail-data";
import { getKulturaRating } from "@/lib/media/kultura-rating";
import {
  buildMediaJsonLd,
  isIndexable,
  mediaPath,
  metaDescription,
  serializeJsonLd,
} from "@/lib/media/seo";
import { isBestFormat } from "@/lib/best/best-of";
import { OG_LOCALE, SITE_NAME } from "@/i18n/metadata";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site-url";
import type { AppLocale } from "@/i18n/detect";

interface Props {
  params: Promise<{ locale: string; type: string; id: string }>;
}

// `React.cache` existe en el React de servidor de Next; en tests, la función.
const dedupe: <T extends (...args: never[]) => unknown>(fn: T) => T =
  (React as unknown as { cache?: <T>(fn: T) => T }).cache ?? ((fn) => fn);

/** Metadatos y página piden la misma ficha: una sola carga por petición. */
const loadDetail = dedupe(loadMediaDetail);

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

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, type, id } = await params;
  const t = await getTranslations({ locale, namespace: "media_detail" });
  const data = await loadDetail(type, id, locale);
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

export default async function MediaDetailPage({ params }: Props) {
  const { locale, type, id } = await params;
  const data = await loadDetail(type, id, locale);
  if (!data) notFound();

  const { item } = data;
  const { user } = await getViewer();
  const supabase = user ? createClient() : null;

  const [initialEntry, kulturaRating, matchScores, synopsis, t, tMedia] = await Promise.all([
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
  ]);

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
    kulturaRating,
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
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
    </>
  );
}
