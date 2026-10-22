import type { Metadata, Viewport } from "next";
import { getTranslations } from "next-intl/server";
import { routing } from "./routing";
import type { AppLocale } from "./detect";
import { siteUrl } from "@/lib/site-url";

/**
 * Hex real de `--surface-base` (oklch(16% 0.015 280), VERIF-B). La barra del
 * sistema, la pantalla de arranque de la PWA y el manifest usan este valor:
 * no admiten OKLCH en todos los navegadores.
 */
export const SURFACE_BASE_HEX = "#0c0d14";

export const SITE_NAME = "KULTURA";

/** `og:locale` de cada idioma de la app. */
export const OG_LOCALE: Record<AppLocale, string> = { es: "es_ES", en: "en_US" };

export const SHELL_VIEWPORT: Viewport = {
  width: "device-width",
  initialScale: 1,
  // MOV-1: el contenido llega hasta los bordes en móviles con muesca; los
  // márgenes seguros los ponen `globals.css` (laterales) y la barra inferior.
  viewportFit: "cover",
  themeColor: SURFACE_BASE_HEX,
  colorScheme: "dark",
};

/** Ruta de la petición (`x-pathname` del middleware) sin query ni hash. */
function cleanPath(pathname: string | null | undefined): string | null {
  if (!pathname || !pathname.startsWith("/") || pathname.startsWith("//")) return null;
  return pathname.split(/[?#]/)[0];
}

/**
 * Metadatos por defecto de todas las páginas de un idioma (TXT-2, TXT-5,
 * SEO-6, SEO-8, MOV-1). Las páginas que definen los suyos los sustituyen
 * campo a campo; todas las URL absolutas salen de `siteUrl()`, así que un
 * cambio de dominio es solo la variable `NEXT_PUBLIC_SITE_URL`.
 *
 * No hay `alternates.canonical` aquí a propósito: heredado por una página que
 * no define el suyo, la marcaría como copia de la portada.
 */
export async function shellMetadata(locale: AppLocale, pathname?: string | null): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "meta" });
  const base = siteUrl();
  const path = cleanPath(pathname);
  const title = t("defaultTitle");
  const description = t("description");

  return {
    metadataBase: new URL(base),
    applicationName: SITE_NAME,
    title: { template: `%s · ${SITE_NAME}`, default: title },
    description,
    verification: {
      google: "KE2RH_Qf5CXAs5mCSDvB_c_4T5C6B1KvHW2Rwb7q3aA",
    },
    appleWebApp: {
      capable: true,
      title: SITE_NAME,
      // "black" y no "black-translucent": la cabecera no reserva el alto de
      // la barra de estado, y en modo app quedaría debajo de la hora.
      statusBarStyle: "black",
    },
    formatDetection: { telephone: false, email: false, address: false },
    openGraph: {
      siteName: SITE_NAME,
      type: "website",
      locale: OG_LOCALE[locale],
      alternateLocale: routing.locales.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      ...(path ? { url: `${base}${path}` } : {}),
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
