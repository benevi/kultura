import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs/config";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// ── Content Security Policy (C7, D-02) ────────────────────────────────────────
// Dos políticas. Las rutas que dependen de quién mira llevan la CSP con nonce
// por petición que pone `src/middleware.ts`. Las rutas cacheables en el CDN
// (portadas, rankings, legales y /offline) llevan esta CSP FIJA: un HTML
// cacheado no puede llevar un nonce por petición. Excepción firmada en el PR
// de F-22: `script-src 'self' 'unsafe-inline'` (sin `unsafe-eval`) solo aquí.
//
// Este archivo no puede importar TypeScript: las cadenas son las mismas que
// `src/lib/csp.ts` (`buildStaticCsp`, `buildReportOnlyCsp`,
// `STATIC_CSP_ROUTES`) y `tests/unit/csp/static-csp.test.ts` exige que
// coincidan.

/** Rutas de la CSP fija, en el formato de `headers()` (path-to-regexp). */
export const STATIC_CSP_SOURCES = [
  "/:locale(es|en)",
  "/:locale(es|en)/best",
  "/:locale(es|en)/best/:path*",
  "/:locale(es|en)/:page(privacy|terms|legal|accessibility|offline)",
];

const CSP_REPORT_PATH = "/api/csp-report";
const CSP_REPORT_GROUP = "csp";

/**
 * @param {string} scriptSrc
 * @param {string} connectSrc
 * @param {boolean} isDev
 * @param {boolean} [reportOnly]
 */
function cspDirectives(scriptSrc, connectSrc, isDev, reportOnly = false) {
  return [
    "default-src 'self'",
    "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    connectSrc,
    "font-src 'self' data:",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    isDev || reportOnly ? null : "upgrade-insecure-requests",
    isDev ? null : `report-uri ${CSP_REPORT_PATH}`,
    isDev ? null : `report-to ${CSP_REPORT_GROUP}`,
  ]
    .filter(Boolean)
    .join("; ");
}

/** CSP fija de las rutas cacheables. En `next dev`, la de desarrollo (HMR). */
export function staticCsp(/** @type {boolean} */ isDev) {
  return isDev
    ? cspDirectives(
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "connect-src 'self' https: ws://localhost:* wss://localhost:* wss://*.supabase.co",
        true,
      )
    : cspDirectives("script-src 'self' 'unsafe-inline'", "connect-src 'self' https: wss://*.supabase.co", false);
}

/** Política solo de informe con `connect-src` acotado (SEG-10). */
export function reportOnlyCsp(/** @type {string | undefined} */ supabaseUrl) {
  const sources = ["'self'"];
  try {
    if (supabaseUrl) {
      const { host, origin } = new URL(supabaseUrl);
      sources.push(origin, `wss://${host}`);
    }
  } catch {
    // URL inválida: solo 'self'.
  }
  sources.push("https://*.ingest.sentry.io", "https://*.ingest.de.sentry.io");
  return cspDirectives("script-src 'self' 'unsafe-inline'", `connect-src ${sources.join(" ")}`, false, true);
}

const IS_DEV = process.env.NODE_ENV !== "production";

/**
 * Todo menos los recursos de `/_next/` (JS, CSS, fuentes, imágenes
 * optimizadas) y el service worker con su interruptor (F-23): una CSP en la
 * respuesta de `/sw.js` se convierte en la política del propio worker.
 */
export const DOCUMENT_SOURCE = "/((?!_next/|sw\\.js|sw-config\\.json).*)";

// ── Sentry ligero en el navegador (REN-2) ─────────────────────────────────────
// La captura de errores se queda; fuera lo que pesa: el tracing del navegador
// (browserTracingIntegration, que el SDK añade por defecto) y, por si algún día
// se vuelve a montar Replay, sus grabaciones de iframes y shadow DOM. Solo en
// el bundle del cliente: `webpack.treeshake.removeTracing` del plugin lo
// quitaría también del servidor y del edge, donde las trazas no pesan al
// usuario y siguen siendo útiles.
/** @param {boolean} isServer */
export function clientSentryDefines(isServer) {
  if (isServer) return null;
  return {
    __SENTRY_TRACING__: false,
    __RRWEB_EXCLUDE_IFRAME__: true,
    __RRWEB_EXCLUDE_SHADOW_DOM__: true,
  };
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // SEG-10: no anunciar el framework (cabecera X-Powered-By: Next.js).
  poweredByHeader: false,
  webpack(config, { isServer, webpack }) {
    const defines = clientSentryDefines(isServer);
    if (defines) config.plugins.push(new webpack.DefinePlugin(defines));
    return config;
  },
  async headers() {
    return [
      // REN-10: el favicon vive en `public/` (en `src/app/` Next le fijaba su
      // propio `max-age=0` y esta regla producía dos Cache-Control
      // contradictorios). Los iconos de la PWA, igual: no cambian sin cambiar
      // de nombre.
      {
        source: "/favicon.ico",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
      {
        source: "/icons/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
      // D-02: CSP fija en las rutas cacheables (el middleware no les pone la
      // del nonce). Sin la de informe en dev: ahí no hay receptor que escuche.
      ...STATIC_CSP_SOURCES.map((source) => ({
        source,
        headers: [{ key: "Content-Security-Policy", value: staticCsp(IS_DEV) }],
      })),
      // SEG-10: a dónde manda Chromium los informes de `report-to csp`, y la
      // política solo de informe con `connect-src` acotado (no bloquea nada;
      // dice qué rompería cerrarlo). Solo en documentos: en los JS, CSS e
      // imágenes de `/_next/` no hacen nada y sumaban ~1 KB por petición.
      {
        source: DOCUMENT_SOURCE,
        headers: [
          { key: "Reporting-Endpoints", value: `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"` },
          ...(IS_DEV
            ? []
            : [{ key: "Content-Security-Policy-Report-Only", value: reportOnlyCsp(process.env.NEXT_PUBLIC_SUPABASE_URL) }]),
        ],
      },
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // HSTS gestionado por Vercel automáticamente (max-age=63072000, verificado 2026-05-03).
          // NO añadir aquí — produciría header duplicado.
          // Bloquea APIs de navegador que la app no usa.
          // SEG-10: aísla el contexto de navegación de las ventanas que abra o
          // que la abran (la app no usa popups: Google entra por redirección).
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
  images: {
    // Las portadas no cambian: sin esto el optimizador de imágenes vuelve a
    // pedir y recomprimir cada una al minuto de caducar (TTL por defecto: 60 s),
    // y la galería de la landing paga ese coste en frío en cada visita.
    minimumCacheTTL: 60 * 60 * 24 * 7,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
      {
        // E-BOOKS-GOOGLE: portadas de Google Books. `books.google.com/books/
        // content?id=…` es el host habitual; `books.googleusercontent.com` y
        // `lh*.googleusercontent.com` aparecen en parte del catálogo.
        protocol: "https",
        hostname: "books.google.com",
      },
      {
        protocol: "https",
        hostname: "books.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
      {
        // Open Library: LEGACY desde E-BOOKS-GOOGLE — solo fichas de ids
        // `book_OL…` ya guardados en bibliotecas (ver resolveBookItem).
        protocol: "https",
        hostname: "covers.openlibrary.org",
      },
      {
        protocol: "https",
        hostname: "uploads.mangadex.org",
      },
      {
        protocol: "https",
        hostname: "media.rawg.io",
      },
      {
        // E-GAMES-STEAM: capturas de la ficha de tienda. Steam las sirve desde
        // varios CDNs según la región/antigüedad del juego.
        protocol: "https",
        hostname: "*.steamstatic.com",
      },
      {
        protocol: "https",
        hostname: "shared.akamaihd.net",
      },
      {
        protocol: "https",
        hostname: "myanimelist.net",
      },
      {
        protocol: "https",
        hostname: "cdn.myanimelist.net",
      },
      {
        // E-ANIME-SOURCE: portadas de AniList (coverImage.extraLarge/large).
        // `s4.anilist.co` es su CDN de medios; `myanimelist.net`/
        // `cdn.myanimelist.net` arriba se conservan solo para fichas legacy
        // de anime guardadas cuando la fuente era Jikan.
        protocol: "https",
        hostname: "s4.anilist.co",
      },
      {
        // ComicVine sirve imágenes desde su propio host (verificado: medium_url
        // = comicvine.gamespot.com/a/uploads/...). *.cbsistatic.com como respaldo
        // por si el CDN cambia.
        protocol: "https",
        hostname: "comicvine.gamespot.com",
      },
      {
        protocol: "https",
        hostname: "*.cbsistatic.com",
      },
    ],
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Sin SENTRY_AUTH_TOKEN el plugin omite la subida de source maps con un aviso
  // (silenciado abajo) — el build y el SDK en runtime no se ven afectados.
  silent: true,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  webpack: {
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: true,
  },
});
