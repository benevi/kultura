/**
 * Entorno de build y arranque de la red de seguridad de accesibilidad: nada
 * apunta a servicios reales (Supabase simulado en localhost, `fetch` sin red).
 * Lo comparten `playwright.a11y.config.ts`, `build.cjs` y el job de CI.
 */
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");
const A11Y_PORT = Number(process.env.A11Y_PORT || 3187);
const MOCK_SUPABASE_PORT = Number(process.env.MOCK_SUPABASE_PORT || 54329);
const BASE_URL = process.env.A11Y_BASE_URL || `http://localhost:${A11Y_PORT}`;
const SUPABASE_URL = `http://localhost:${MOCK_SUPABASE_PORT}`;

const A11Y_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "a11y-anon-key",
  NEXT_PUBLIC_SITE_URL: BASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: "a11y-service-role-key",
  TMDB_API_KEY: "a11y-tmdb",
  RAWG_API_KEY: "a11y-rawg",
  COMICVINE_KEY: "a11y-comicvine",
  ANTHROPIC_API_KEY: "sk-ant-a11y",
  MOCK_SUPABASE_PORT: String(MOCK_SUPABASE_PORT),
  NEXT_TELEMETRY_DISABLED: "1",
  NODE_OPTIONS: `--require ${path.join(ROOT, "tests/e2e/a11y/offline-fetch.cjs")}`,
};

module.exports = { ROOT, A11Y_PORT, MOCK_SUPABASE_PORT, BASE_URL, SUPABASE_URL, A11Y_ENV };
