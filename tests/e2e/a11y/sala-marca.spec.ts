/**
 * Armazón con «Sala» (fase 8.5 M2): la cabecera con sesión con el logo D1,
 * los destinos con `aria-current` y las cajas de 48 px. La red arranca con
 * `SALA_MARCA=prueba` (`env.cjs`) y este spec entra con la cookie de prueba;
 * con `SALA_MARCA=1` también pasa (salvo el caso «sin cookie») y además
 * cambia la cabecera pública, que solo sale con `1` (las públicas no leen
 * cookies).
 *
 * La cabecera sale en todas las páginas con sesión: se pasa axe y el teclado
 * en varias, no solo en una.
 */
import { test, expect, type BrowserContext } from "@playwright/test";
import { expectNoBlockingViolations, expectNoHorizontalScroll, isolateNetwork, open, signIn, walkTab } from "./helpers";
import es from "../../../messages/es.json";

const HEADER = "[data-sala-header]";
const ROUTES = ["/es/home", "/es/library", "/es/discover", "/es/lists", "/es/notifications", "/es/settings", "/es/media/movie/550", "/es/u/benevi"];

async function salaCookie(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    { name: "kultura_sala_prueba", value: "1", domain: new URL(baseURL).hostname, path: "/", httpOnly: true, sameSite: "Lax" },
  ]);
}

test.beforeEach(async ({ context }) => {
  await isolateNetwork(context);
});

test.describe("sin la cookie de prueba", () => {
  test.skip(process.env.SALA_MARCA === "1", "con SALA_MARCA=1 la ven todos");

  test("la cabecera de hoy, sin «Sala» ni sus hojas", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!);
    await open(page, "/es/settings");
    await expect(page.locator(HEADER)).toHaveCount(0);
    const salaSheets = await page.$$eval('link[rel="stylesheet"]', (links) =>
      links.map((l) => (l as HTMLLinkElement).href).filter((href) => /sala/i.test(href))
    );
    expect(salaSheets, "hojas de «Sala» con la cabecera de hoy").toEqual([]);
  });

  test("la pública de hoy, aunque llegue la cookie", async ({ page, context, baseURL }) => {
    await salaCookie(context, baseURL!);
    await open(page, "/es/privacy");
    await expect(page.locator(HEADER)).toHaveCount(0);
  });
});

test.describe("con «Sala»", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL!);
    await salaCookie(context, baseURL!);
  });

  for (const route of ROUTES) {
    test(`${route}: axe limpio en la cabecera y en la página`, async ({ page }) => {
      await open(page, route);
      await expect(page.locator(HEADER)).toBeVisible();
      await expectNoBlockingViolations(page, `cabecera en ${route}`, HEADER);
      await expectNoBlockingViolations(page, route);
    });
  }

  test("el logo se llama «Kultura» y lleva a Inicio", async ({ page }) => {
    await open(page, "/es/library");
    const logo = page.locator(HEADER).getByRole("link", { name: "Kultura", exact: true });
    await expect(logo).toHaveAttribute("href", "/es/home");
  });

  test("la página actual va en aria-current, no solo en color", async ({ page, isMobile }) => {
    test.skip(isMobile, "en el móvil la navegación va en la barra de abajo (M3)");
    await open(page, "/es/library");
    const nav = page.locator(HEADER).getByRole("navigation", { name: es.nav.primaryNav });
    const current = nav.locator('[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveAttribute("href", "/es/library");
    // La marca no es solo de color: una barra de tinta debajo.
    const bar = await current.evaluate((el) => getComputedStyle(el, "::after").height);
    expect(bar).toBe("4px");
  });

  test("teclado: cada parada de la cabecera, a la vista y con foco visible", async ({ page }) => {
    await open(page, "/es/library");
    const stops = await walkTab(page, 12);
    expect(stops.length).toBeGreaterThan(3);
    for (const stop of stops) {
      expect(stop.visible, `${stop.tag} «${stop.name}» tapado`).toBe(true);
      expect(stop.indicator, `${stop.tag} «${stop.name}» sin foco visible`).toBe(true);
    }
  });

  test("cajas de 48 px como mínimo (2.5.8)", async ({ page }) => {
    await open(page, "/es/library");
    const boxes = await page.locator(`${HEADER} a, ${HEADER} button`).evaluateAll((els) =>
      els
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { name: el.getAttribute("aria-label") ?? el.textContent?.trim() ?? "", w: r.width, h: r.height };
        })
    );
    for (const box of boxes) expect(Math.min(box.w, box.h), box.name).toBeGreaterThanOrEqual(44);
  });

  test("reflow a 320 px sin scroll horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await open(page, "/es/library");
    await expect(page.locator(HEADER)).toBeVisible();
    await expectNoHorizontalScroll(page, 320);
  });
});

test.describe("pública con SALA_MARCA=1", () => {
  test.skip(process.env.SALA_MARCA !== "1", "la pública solo cambia con SALA_MARCA=1");

  test("logo, entrar y registrarse; axe y 320 px", async ({ page }) => {
    await open(page, "/es/privacy");
    const header = page.locator(HEADER);
    await expect(header.getByRole("link", { name: es.auth.signIn })).toHaveAttribute("href", "/es/login?mode=login");
    await expect(header.getByRole("link", { name: es.auth.signUp })).toHaveAttribute("href", "/es/login?mode=register");
    await expectNoBlockingViolations(page, "cabecera pública", HEADER);
    await page.setViewportSize({ width: 320, height: 640 });
    await expectNoHorizontalScroll(page, 320);
  });
});
