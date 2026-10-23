/**
 * Precarga para `next build` / `next start` en la red de seguridad de
 * accesibilidad (ACC-18): `NODE_OPTIONS="--require ./tests/e2e/a11y/offline-fetch.cjs"`.
 *
 * Sustituye `fetch` del proceso de Node ANTES de que Next lo envuelva:
 * - localhost (el Supabase simulado y la propia app) pasa tal cual;
 * - TMDB responde con los datos fijos de `fixtures.cjs`;
 * - cualquier otro host (RAWG, AniList, Anthropic…) devuelve 503 al
 *   instante, que la app ya trata como "proveedor caído".
 * Ninguna petición sale a Internet: el job no depende de terceros ni de su
 * latencia, y cada ejecución pinta lo mismo.
 */
const { tmdbResponse } = require("./fixtures.cjs");

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

globalThis.fetch = async function offlineFetch(input, init) {
  let url;
  try {
    url = urlOf(input);
  } catch {
    return realFetch(input, init);
  }
  if (LOCAL.has(url.hostname)) return realFetch(input, init);
  if (url.hostname === "api.themoviedb.org") {
    const body = tmdbResponse(url.pathname);
    return body ? json(200, body) : json(404, { status_code: 34 });
  }
  return json(503, { error: "offline (a11y CI)" });
};
