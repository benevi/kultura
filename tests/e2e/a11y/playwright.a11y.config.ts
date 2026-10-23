/**
 * Red de seguridad de accesibilidad (ACC-18): axe, reflow, teclado y diálogos.
 *
 * Se ejecuta contra un `next start` construido con el entorno de `env.cjs`
 * (Supabase simulado en localhost y `fetch` sin red, ver `offline-fetch.cjs`):
 *
 *   npm run test:a11y:build   # una vez (o tras cambiar código)
 *   npm run test:a11y
 *
 * Con `A11Y_BASE_URL` apunta a un servidor ya arrancado y no levanta nada.
 */
import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ROOT, A11Y_PORT, MOCK_SUPABASE_PORT, BASE_URL, A11Y_ENV } = require("./env.cjs");

export default defineConfig({
  testDir: __dirname,
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // Sin reintentos: un resultado que cambia entre ejecuciones es un fallo
  // que hay que arreglar, no que esconder.
  retries: 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: path.join(ROOT, "playwright-report/a11y") }]]
    : "list",
  outputDir: path.join(ROOT, "test-results/a11y"),
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    // Animaciones fuera: axe mide contrastes y estados estables, no un
    // fotograma a medio fundido. La intro con movimiento la cubre F-09.
    contextOptions: { reducedMotion: "reduce" },
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
  },
  projects: [
    {
      name: "movil-390",
      use: { ...devices["Pixel 5"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "escritorio-1440",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
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
