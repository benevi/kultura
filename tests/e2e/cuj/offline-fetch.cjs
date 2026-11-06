/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Precarga de `fetch` para la red CUJ (`NODE_OPTIONS=--require …`).
 *
 * Como la de accesibilidad (`tests/e2e/a11y/offline-fetch.cjs`), pero las
 * búsquedas de TMDB (`/3/search/*`) FILTRAN por `query`: así «buscar» prueba
 * de verdad que la consulta llega al proveedor y que lo que no coincide no
 * sale (y una importación por título inexistente queda sin emparejar).
 * - localhost (Supabase local y la propia app) pasa tal cual;
 * - TMDB, datos fijos de `tests/e2e/a11y/fixtures.cjs`;
 * - cualquier otro host, 503 al instante (la app lo trata como caído).
 */
const { tmdbResponse } = require("../a11y/fixtures.cjs");

const realFetch = globalThis.fetch;
const LOCAL = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function urlOf(input) {
  if (typeof input === "string") return new URL(input);
  if (input instanceof URL) return input;
  return new URL(input.url);
}

const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function tmdb(url) {
  const body = tmdbResponse(url.pathname);
  if (!body) return json(404, { status_code: 34 });
  if (url.pathname.startsWith("/3/search/") && Array.isArray(body.results)) {
    const q = norm(url.searchParams.get("query"));
    const results = body.results.filter((r) => norm(r.title ?? r.name).includes(q));
    return json(200, { ...body, results, total_results: results.length, total_pages: results.length ? 1 : 0 });
  }
  return json(200, body);
}

// Portadas de TMDB: un PNG de 1×1 px. Con 503, el optimizador de imágenes
// falla, el grid oculta la tarjeta (portada rota) y «buscar» dependía de una
// carrera entre ese error y la comprobación del test.
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

globalThis.fetch = async function cujOfflineFetch(input, init) {
  let url;
  try {
    url = urlOf(input);
  } catch {
    return realFetch(input, init);
  }
  if (LOCAL.has(url.hostname)) return realFetch(input, init);
  if (url.hostname === "api.themoviedb.org") return tmdb(url);
  if (url.hostname === "image.tmdb.org") {
    return new Response(PNG_1PX, { status: 200, headers: { "content-type": "image/png" } });
  }
  return json(503, { error: "offline (CUJ CI)" });
};
