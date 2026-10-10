import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site-url";

/** Páginas públicas, una entrada por idioma con sus alternativas. */
const PUBLIC_PATHS = ["", "/login", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PUBLIC_PATHS.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: `${base}/${locale}${path}`,
      changeFrequency: path === "" ? ("weekly" as const) : ("yearly" as const),
      priority: path === "" ? 1 : 0.5,
      alternates: {
        languages: Object.fromEntries(routing.locales.map((l) => [l, `${base}/${l}${path}`])),
      },
    })),
  );
}
