// ============================================================
// KULTURA — Metadatos y datos estructurados de /best (SEO-2, SEO-7, SEO-10)
// Funciones puras: las usan las tres páginas de rankings (hub general, hub
// por formato y ranking de un año) y se prueban sin Next.
// ============================================================

import type { Metadata } from "next";
import { siteUrl } from "@/lib/site-url";
import { bestItemPath, type BestItem } from "@/lib/best/best-of";

const LOCALES = ["es", "en"] as const;
type Locale = (typeof LOCALES)[number];
const OG_LOCALE: Record<Locale, string> = { es: "es_ES", en: "en_US" };

export function bestLocale(locale: string): Locale {
  return locale === "en" ? "en" : "es";
}

/** URL absoluta de una ruta sin idioma (`/best/anime`) en `locale`. */
export function absoluteUrl(locale: string, path: string): string {
  return `${siteUrl()}/${bestLocale(locale)}${path === "/" ? "" : path}`;
}

/**
 * Metadatos completos de una página de /best. Next SUSTITUYE (no fusiona) el
 * `openGraph` del layout, así que se repiten `siteName`, `locale` y `url`.
 * `indexable: false` = `noindex, follow` (lista corta o vacía, D-16).
 */
export function bestMetadata({
  locale,
  path,
  title,
  description,
  indexable = true,
}: {
  locale: string;
  path: string;
  title: string;
  description: string;
  indexable?: boolean;
}): Metadata {
  const l = bestLocale(locale);
  const ogTitle = `${title} · KULTURA`;
  return {
    title,
    description,
    ...(indexable ? {} : { robots: { index: false, follow: true } }),
    alternates: {
      canonical: absoluteUrl(l, path),
      languages: {
        es: absoluteUrl("es", path),
        en: absoluteUrl("en", path),
        "x-default": absoluteUrl("es", path),
      },
    },
    openGraph: {
      siteName: "KULTURA",
      type: "website",
      locale: OG_LOCALE[l],
      alternateLocale: LOCALES.filter((x) => x !== l).map((x) => OG_LOCALE[x]),
      url: absoluteUrl(l, path),
      title: ogTitle,
      description,
    },
    twitter: { card: "summary_large_image", title: ogTitle, description },
  };
}

export interface Crumb {
  name: string;
  /** Ruta sin idioma; la última miga puede no llevarla (página actual). */
  path: string;
}

export function breadcrumbJsonLd(locale: string, crumbs: Crumb[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(locale, c.path),
    })),
  };
}

/**
 * Portada absoluta para el JSON-LD: la del proveedor tal cual (Google la
 * descarga una vez; no gasta el cupo del optimizador).
 */
function imageUrl(poster: string): string | undefined {
  return /^https?:\/\//.test(poster) ? poster : undefined;
}

/**
 * Página de ranking como `CollectionPage` cuya entidad principal es el
 * `ItemList` (carrusel de Google: cada `ListItem` con `url` a la ficha
 * pública e `image`, SEO-2). Sin `aggregateRating`: la nota es del proveedor,
 * no de KULTURA (VERIF-C).
 */
export function rankingJsonLd({
  locale,
  path,
  title,
  description,
  updatedAt,
  items,
  crumbs,
}: {
  locale: string;
  path: string;
  title: string;
  description: string;
  updatedAt?: string;
  items: BestItem[];
  crumbs: Crumb[];
}) {
  const url = absoluteUrl(locale, path);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": url,
        url,
        name: title,
        description,
        inLanguage: bestLocale(locale),
        ...(updatedAt ? { dateModified: updatedAt } : {}),
        breadcrumb: breadcrumbJsonLd(locale, crumbs),
        mainEntity: {
          "@type": "ItemList",
          name: title,
          numberOfItems: items.length,
          itemListOrder: "https://schema.org/ItemListOrderDescending",
          itemListElement: items.map((item, i) => {
            const image = imageUrl(item.poster);
            return {
              "@type": "ListItem",
              position: i + 1,
              name: item.title,
              url: absoluteUrl(locale, bestItemPath(item)),
              ...(image ? { image } : {}),
            };
          }),
        },
      },
    ],
  };
}

/** JSON-LD de un hub: `CollectionPage` con sus migas y los rankings que enlaza. */
export function hubJsonLd({
  locale,
  path,
  title,
  description,
  crumbs,
  links,
}: {
  locale: string;
  path: string;
  title: string;
  description: string;
  crumbs: Crumb[];
  links: Array<{ name: string; path: string }>;
}) {
  const url = absoluteUrl(locale, path);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": url,
        url,
        name: title,
        description,
        inLanguage: bestLocale(locale),
        breadcrumb: breadcrumbJsonLd(locale, crumbs),
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: links.length,
          itemListElement: links.map((l, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: l.name,
            url: absoluteUrl(locale, l.path),
          })),
        },
      },
    ],
  };
}

/** `<script type="application/ld+json">` sin poder cerrar la etiqueta (`<`). */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
