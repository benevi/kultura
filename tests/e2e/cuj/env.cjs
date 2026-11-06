/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Entorno de la red de pruebas CUJ (F0, PLAN_ESTRATEGICO §7.3): la app
 * construida y arrancada contra **Supabase local** (`supabase start`, con
 * todas las migraciones de `supabase/migrations/`) y sin red hacia los
 * proveedores (TMDB responde con los datos fijos del job de accesibilidad;
 * el resto, 503). Lo comparten `playwright.cuj.config.ts`, `build.cjs` y los
 * helpers de los tests.
 *
 * Las claves salen de `supabase status -o env` (API_URL, ANON_KEY,
 * SERVICE_ROLE_KEY). Si la URL no es local, se aborta: esta red nunca escribe
 * en producción ni en kultura-test.
 */
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");
const CUJ_PORT = Number(process.env.CUJ_PORT || 3188);
const BASE_URL = `http://localhost:${CUJ_PORT}`;

const SUPABASE_URL = (process.env.API_URL || process.env.SUPABASE_URL || "http://127.0.0.1:54321").replace(/\/$/, "");
const ANON_KEY = process.env.ANON_KEY || process.env.PUBLISHABLE_KEY || "";
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || process.env.SECRET_KEY || "";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Aborta si las claves faltan o la URL no es de Supabase local. */
function assertLocalSupabase() {
  let host;
  try {
    host = new URL(SUPABASE_URL).hostname;
  } catch {
    throw new Error(`CUJ: API_URL no es una URL válida: ${SUPABASE_URL}`);
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`CUJ: REFUSED — ${SUPABASE_URL} no es Supabase local. Esta red solo corre contra \`supabase start\`.`);
  }
  if (!ANON_KEY || !SERVICE_ROLE_KEY) {
    throw new Error("CUJ: faltan ANON_KEY / SERVICE_ROLE_KEY (ejecuta `supabase status -o env` y expórtalas).");
  }
}

const CUJ_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
  NEXT_PUBLIC_SITE_URL: BASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  TMDB_API_KEY: "cuj-tmdb",
  RAWG_API_KEY: "cuj-rawg",
  COMICVINE_KEY: "cuj-comicvine",
  ANTHROPIC_API_KEY: "sk-ant-cuj",
  // Banderas de v2 cuyas migraciones ya están en local: se prueba ese camino
  // (progreso por formato F-27 y nota /10 F-24), no el de compatibilidad.
  PROGRESS_V2: "1",
  RATING_SCALE_10: "1",
  NEXT_TELEMETRY_DISABLED: "1",
  // `fetch` sin red (ver offline-fetch.cjs): localhost pasa tal cual; TMDB,
  // datos fijos con búsqueda que filtra; el resto, 503.
  NODE_OPTIONS: `--require ${path.join(ROOT, "tests/e2e/cuj/offline-fetch.cjs")}`,
};

module.exports = { ROOT, CUJ_PORT, BASE_URL, SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY, CUJ_ENV, assertLocalSupabase };
