/**
 * F-23 · PWA sin conexión e instalación, en un navegador de verdad.
 *
 * Reutiliza el montaje de la red de seguridad de accesibilidad: un
 * `next start` de PRODUCCIÓN (el service worker solo se registra en
 * producción) construido con el entorno de `a11y/env.cjs` (Supabase simulado
 * en localhost, `fetch` del servidor sin red):
 *
 *   npm run test:a11y:build
 *   npx playwright test -c tests/e2e/pwa/playwright.pwa.config.ts
 *
 * Con `A11Y_BASE_URL` apunta a un servidor ya arrancado y no levanta nada.
 * Si los puertos están ocupados, `A11Y_PORT` y `MOCK_SUPABASE_PORT` (los
 * mismos en el build y en la ejecución: van incrustados en el build).
 * Solo Chromium: es donde se puede comprobar la instalabilidad (CDP).
 */
import { defineConfig, devices } from "@playwright/test";

// Sin esto, en Chromium `context.setOffline()` y `context.route()` no alcanzan
// a las peticiones que hace el propio service worker (las ve como red real).
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1";
import path from "node:path";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ROOT, A11Y_PORT, MOCK_SUPABASE_PORT, BASE_URL, A11Y_ENV } = require("../a11y/env.cjs");

export default defineConfig({
  testDir: __dirname,
  testMatch: /.*\.spec\.ts$/,
  // Las specs se saltan si no las lanza esta config (el servidor de
  // `playwright.config.ts` es `next dev`, sin service worker).
  metadata: { pwa: true },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: path.join(ROOT, "playwright-report/pwa") }]]
    : "list",
  outputDir: path.join(ROOT, "test-results/pwa"),
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    serviceWorkers: "allow",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.A11Y_BASE_URL
    ? undefined
    : [
        {
          command: "node tests/e2e/a11y/mock-supabase.cjs",
          cwd: ROOT,
          url: `http://localhost:${MOCK_SUPABASE_PORT}/health`,
          reuseExistingServer: !process.env.CI,
          env: { MOCK_SUPABASE_PORT: String(MOCK_SUPABASE_PORT) },
          timeout: 20_000,
        },
        {
          command: `npx next start -p ${A11Y_PORT}`,
          cwd: ROOT,
          url: `${BASE_URL}/es/privacy`,
          reuseExistingServer: !process.env.CI,
          env: { ...(process.env as Record<string, string>), ...A11Y_ENV },
          timeout: 120_000,
        },
      ],
});
