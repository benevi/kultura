import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import * as fs from "fs";
import * as path from "path";

// Cargar .env.local (base) para que TEST_USER_* lleguen al proceso de Playwright
loadEnvConfig(process.cwd());

// Leer .env.test.local y mergear: sobreescribe NEXT_PUBLIC_SUPABASE_* con
// los valores de kultura-test, para que el dev server arranque contra el
// proyecto de test (no producción). Las demás vars se heredan de .env.local.
const testEnvPath = path.resolve(process.cwd(), ".env.test.local");
const testEnvOverrides: Record<string, string> = {};
if (fs.existsSync(testEnvPath)) {
  for (const line of fs.readFileSync(testEnvPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    testEnvOverrides[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      ...(process.env as Record<string, string>),
      ...testEnvOverrides,
    },
  },
});
