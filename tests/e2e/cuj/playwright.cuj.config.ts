/**
 * Red de pruebas CUJ con BD real (F0, PLAN_ESTRATEGICO §7.3): los 8 recorridos
 * críticos contra un `next start` construido con `env.cjs` y Supabase local.
 *
 *   supabase start                 # migraciones de supabase/migrations/
 *   (exporta API_URL, ANON_KEY, SERVICE_ROLE_KEY de `supabase status -o env`)
 *   npm run test:cuj:build
 *   npm run test:cuj
 *
 * `bypassCSP`: la CSP de producción solo deja `connect-src 'self' https:` y el
 * Supabase local es `http://127.0.0.1:54321`. Se desactiva solo en el
 * navegador de los tests; la CSP real la vigilan sus tests de unidad.
 */
import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ROOT, CUJ_PORT, BASE_URL, CUJ_ENV, assertLocalSupabase } = require("./env.cjs");

assertLocalSupabase();
// Los specs de b3_5e leen la URL de aquí (por defecto apuntaban al dev :3001).
process.env.E2E_BASE_URL = BASE_URL;

// Los b3_5e necesitan el usuario A de seed-test.mjs. En CI es obligatorio (un
// `skip` silencioso sería un verde falso); en local, sin él, no se incluyen.
const hasSeedUser = Boolean(process.env.TEST_USER_EMAIL && process.env.TEST_USER_PASSWORD);
if (process.env.CI && !hasSeedUser) {
  throw new Error("CUJ: faltan TEST_USER_EMAIL / TEST_USER_PASSWORD (usuario de scripts/seed-test.mjs).");
}

export default defineConfig({
  testDir: __dirname,
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // Sin reintentos: un CUJ que cambia entre ejecuciones es un fallo a arreglar.
  retries: 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: path.join(ROOT, "playwright-report/cuj") }]]
    : "list",
  outputDir: path.join(ROOT, "test-results/cuj"),
  use: {
    baseURL: BASE_URL,
    bypassCSP: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    contextOptions: { reducedMotion: "reduce" },
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
  },
  projects: [
    {
      name: "escritorio-1440",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      // Registro y entrar también a 390 px (la puerta de entrada es móvil).
      name: "movil-390",
      testMatch: /(registro|entrar)\.spec\.ts$/,
      use: { ...devices["Pixel 5"], viewport: { width: 390, height: 844 } },
    },
    ...(hasSeedUser ? [{
      // b3_5e convertidos (no borrados): Descubrir e idioma, con el usuario A de
      // scripts/seed-test.mjs. Ojo: los de Descubrir simulan /api/discover en
      // el navegador (prueban la UI y el i18n, no la BD); solo el login es real.
      // Chat, grupos y notificaciones son v2.1: siguen en su sitio sin correr.
      name: "b3_5e",
      testDir: path.join(ROOT, "tests/e2e/b3_5e_safety_net"),
      testMatch: /(discover-filters|discover-pagination|language-switch)\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    }] : []),
  ],
  webServer: {
    command: `npx next start -p ${CUJ_PORT}`,
    cwd: ROOT,
    url: `${BASE_URL}/es/privacy`,
    reuseExistingServer: !process.env.CI,
    env: { ...(process.env as Record<string, string>), ...CUJ_ENV },
    timeout: 120_000,
  },
});
