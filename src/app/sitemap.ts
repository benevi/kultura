import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site-url";
import { BEST_FORMATS, bestYears } from "@/lib/best/best-of";

/** Páginas públicas, una entrada por idioma con sus alternativas. */
const STATIC_PATHS = ["", "/login", "/privacy", "/terms"];

/** Rankings públicos "Mejores X de {año}" (formatos × años publicados). */
const BEST_PATHS = BEST_FORMATS.flatMap((format) =>
  bestYears().map((year) => `/best/${format}/${year}`)
);

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [...STATIC_PATHS, ...BEST_PATHS].flatMap((path) =>
    routing.locales.map((locale) => ({
      url: `${base}/${locale}${path}`,
      changeFrequency: path === "" || path.startsWith("/best/") ? ("weekly" as const) : ("yearly" as const),
      priority: path === "" ? 1 : 0.5,
      alternates: {
        languages: Object.fromEntries(routing.locales.map((l) => [l, `${base}/${l}${path}`])),
      },
    })),
  );
}
