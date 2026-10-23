/**
 * ACC-18 · Páginas: axe (WCAG 2.2 A/AA, falla con `serious`/`critical`) en las
 * públicas y en las de la app con sesión simulada, a 390 y 1440 px (un
 * proyecto por ancho); reflow a 320 px y recorrido con Tab.
 */
import { test, expect } from "@playwright/test";
import {
  expectNoBlockingViolations,
  expectNoHorizontalScroll,
  isolateNetwork,
  open,
  signIn,
  walkTab,
} from "./helpers";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { LIST_ID, GROUP_ID, CONVERSATION_ID } = require("./fixtures.cjs");

const PUBLIC_PAGES: Array<{ path: string; status?: number }> = [
  { path: "/es" },
  { path: "/en" },
  { path: "/es/best/movie/2026" },
  { path: "/es/u/benevi" },
  { path: "/es/login" },
  { path: "/es/privacy" },
  { path: "/es/terms" },
  { path: "/es/esta-pagina-no-existe", status: 404 },
  // Ficha pública (D-01, F-15): sin sesión, con cabecera pública.
  { path: "/es/media/movie/550" },
];

const APP_PAGES = [
  "/es/home",
  "/es/discover",
  "/es/library",
  "/es/lists",
  `/es/lists/${LIST_ID}`,
  "/es/friends",
  "/es/groups",
  `/es/groups/${GROUP_ID}`,
  "/es/chat",
  `/es/chat/${CONVERSATION_ID}`,
  "/es/notifications",
  "/es/settings",
  "/es/suggestions",
  "/es/profile/a11y_tester",
  "/es/media/movie/550",
];

test.beforeEach(async ({ context }) => {
  await isolateNetwork(context);
});

test.describe("públicas sin sesión", () => {
  for (const { path, status = 200 } of PUBLIC_PAGES) {
    test(`axe ${path}`, async ({ page }) => {
      await open(page, path, status);
      await expect(page.locator("main")).toHaveCount(1);
      await expectNoBlockingViolations(page, path);
    });
  }

  test("reflow a 320 px sin scroll horizontal (WCAG 1.4.10)", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    for (const { path, status = 200 } of PUBLIC_PAGES) {
      await open(page, path, status);
      await test.step(path, () => expectNoHorizontalScroll(page, 320));
    }
  });

  test("Tab: cada parada a la vista y con indicador de foco (2.4.7, 2.4.11)", async ({ page }) => {
    for (const { path, status = 200 } of PUBLIC_PAGES) {
      await open(page, path, status);
      const stops = await walkTab(page);
      expect(stops.length, `${path}: ninguna parada de Tab`).toBeGreaterThan(0);
      const bad = stops.filter((s) => !s.visible || !s.indicator);
      expect(bad, `${path}: paradas sin foco visible`).toEqual([]);
    }
  });
});

test.describe("app con sesión (Supabase simulado)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL!);
  });

  for (const path of APP_PAGES) {
    test(`axe ${path}`, async ({ page }) => {
      await open(page, path);
      // Comprobación de que la sesión simulada funciona (no es el login).
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator("main")).toHaveCount(1);
      await expectNoBlockingViolations(page, path);
    });
  }

  test("Tab en la app: cada parada a la vista y con indicador de foco", async ({ page }) => {
    for (const path of ["/es/lists", "/es/settings", "/es/suggestions", `/es/chat/${CONVERSATION_ID}`]) {
      await open(page, path);
      const stops = await walkTab(page, 60);
      const bad = stops.filter((s) => !s.visible || !s.indicator);
      expect(bad, `${path}: paradas sin foco visible`).toEqual([]);
    }
  });
});
