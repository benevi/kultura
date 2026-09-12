import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs/config";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// ── Content Security Policy ───────────────────────────────────────────────────
// C7: la CSP se genera dinámicamente por request en `src/middleware.ts` (necesita
// inyectar un nonce distinto en cada respuesta) — no puede ser un header estático
// aquí. Ver `src/lib/csp.ts` para las directivas. Los headers de abajo sí son
// estáticos (no dependen del request) y se quedan en next.config.mjs.

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
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
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
  images: {
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
