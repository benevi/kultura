import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// ── Content Security Policy ───────────────────────────────────────────────────
// Dev:  'unsafe-eval' + ws/wss necesarios para webpack HMR de Next.js.
// Prod: sin 'unsafe-eval', sin ws — más estricto.
const isDev = process.env.NODE_ENV === "development";

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
  // Next.js dev (webpack) requiere unsafe-eval para source maps y HMR
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  // ws/wss necesario en dev para Fast Refresh WebSocket; wss://*.supabase.co para Realtime en prod
  isDev
    ? "connect-src 'self' https: ws://localhost:* wss://localhost:* wss://*.supabase.co"
    : "connect-src 'self' https: wss://*.supabase.co",
  "font-src 'self' data:",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
];

const CSP = CSP_DIRECTIVES.join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: CSP,
          },
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

export default withNextIntl(nextConfig);
