import type { MetadataRoute } from "next";
import es from "../../messages/es.json";
import { routing } from "@/i18n/routing";
import { SITE_NAME, SURFACE_BASE_HEX } from "@/i18n/metadata";

/**
 * MOV-1: manifest de la PWA (`/manifest.webmanifest`, Next añade el `<link>`).
 *
 * - `start_url` es la portada del idioma por defecto y no `/home`: quien
 *   instala sin cuenta acabaría en el login (VERIF-B); con sesión, la portada
 *   ya lleva a Inicio.
 * - Colores = hex real de `--surface-base` (VERIF-B), igual que `themeColor`.
 * - Un manifest no se puede servir por idioma: va en el idioma por defecto.
 */
export default function manifest(): MetadataRoute.Manifest {
  const home = `/${routing.defaultLocale}`;
  return {
    id: "/",
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: es.meta.description,
    lang: routing.defaultLocale,
    dir: "ltr",
    start_url: home,
    scope: "/",
    display: "standalone",
    background_color: SURFACE_BASE_HEX,
    theme_color: SURFACE_BASE_HEX,
    categories: ["entertainment", "lifestyle", "books"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: es.nav.library,
        url: `${home}/library`,
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: es.nav.discover,
        url: `${home}/discover`,
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
    share_target: SHARE_TARGET,
  };
}

/**
 * MOV-9: con la app instalada, aparece en la hoja de Compartir del sistema.
 * Lo compartido (p. ej. un enlace de TMDB) abre la búsqueda: lo recibe
 * `src/app/[locale]/share/route.ts`. Forma de la especificación (Web Share
 * Target, `params` como objeto); el tipo de Next la describe distinta.
 */
export const SHARE_TARGET = {
  action: `/${routing.defaultLocale}/share`,
  method: "GET",
  enctype: "application/x-www-form-urlencoded",
  params: { title: "title", text: "text", url: "url" },
} as const;
