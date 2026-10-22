import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs/config";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// ── Content Security Policy ───────────────────────────────────────────────────
// C7: la CSP se genera dinámicamente por request en `src/middleware.ts` (necesita
// inyectar un nonce distinto en cada respuesta) — no puede ser un header estático
// aquí. Ver `src/lib/csp.ts` para las directivas. Los headers de abajo sí son
// estáticos (no dependen del request) y se quedan en next.config.mjs.

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
      {
        // REN-10: el favicon casi nunca cambia; sin esto Next lo sirve con
        // max-age=0 y cada visita lo revalida.
        source: "/favicon.ico",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
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
