/**
 * F-23 · MOV-2 / MOV-3 en Chromium contra el build de producción:
 * - el service worker se registra en la zona con sesión y precachea /offline;
 * - con `context.setOffline(true)`, una navegación (también `start_url`)
 *   muestra la página offline en su idioma, y al volver la red se reintenta;
 * - en Cache Storage nunca hay HTML de páginas ni /api/*;
 * - la app es instalable (`Page.getInstallabilityErrors` vacío);
 * - el aviso de instalación sale en la 2.ª visita, «Ahora no» lo calla 30
 *   días, y `appinstalled` se manda a /api/pwa/installed.
 */
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { expectNoBlockingViolations, isolateNetwork, open, signIn } from "../a11y/helpers";

test.beforeEach(async ({ context }, testInfo) => {
  test.skip(!testInfo.config.metadata?.pwa, "se ejecuta con tests/e2e/pwa/playwright.pwa.config.ts");
  await isolateNetwork(context);
});

/** Entra en la app y espera a que el worker controle la página. */
async function boot(page: Page, path = "/es/home") {
  await page.goto(path, { waitUntil: "load" });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }),
      );
    }
  });
}

/**
 * Corta la red. `setOffline` no alcanza a las peticiones del propio worker en
 * Chromium (salen como red real), así que además se abortan con
 * `context.route`, que sí las ve con PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS
 * (lo pone la config).
 */
async function goOffline(context: BrowserContext) {
  await context.setOffline(true);
  await context.route(/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/, (route) => route.abort("internetdisconnected"));
}

async function goOnline(context: BrowserContext) {
  await context.unroute(/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/);
  await context.setOffline(false);
}

async function cacheContents(page: Page) {
  return page.evaluate(async () => {
    const out: Record<string, string[]> = {};
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      out[name] = (await cache.keys()).map((r) => new URL(r.url).pathname);
    }
    return out;
  });
}

test.describe("service worker y modo sin conexión", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL!);
  });

  test("se registra con scope / y precachea la página offline de los dos idiomas", async ({ page }) => {
    await boot(page);
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope);
    expect(new URL(scope!).pathname).toBe("/");
    const contents = await cacheContents(page);
    expect(contents["kultura-offline-v1"]?.sort()).toEqual(["/en/offline", "/es/offline"]);
    expect(contents["kultura-static-v1"]?.length ?? 0).toBeGreaterThan(0);
  });

  test("sin red: navegar muestra /offline en la URL pedida y en su idioma", async ({ page, context }) => {
    await boot(page);
    await goOffline(context);

    const res = await page.goto("/es/library");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sin conexión");
    expect(new URL(page.url()).pathname).toBe("/es/library");

    await page.goto("/en/discover");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("You're offline");
  });

  test("sin red: arrancar en start_url (/es) abre la página offline con su CSS", async ({ page, context }) => {
    await boot(page);
    await goOffline(context);
    await page.goto("/es");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sin conexión");
    // Los estáticos salen de la caché: la página no se pinta sin estilos.
    const bg = await page.evaluate(() => getComputedStyle(document.querySelector("main")!).backgroundColor);
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
  });

  test("sin red, un enlace interno también acaba en la página offline", async ({ page, context }) => {
    await boot(page);
    await goOffline(context);
    await page.locator('a[href="/es/library"]').first().click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sin conexión");
  });

  test("«Reintentar» sin red vuelve a la página offline; al volver la red se reintenta solo", async ({ page, context }) => {
    await boot(page);
    await goOffline(context);
    await page.goto("/es/notifications");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("Sin conexión");
    await page.getByRole("button", { name: "Reintentar" }).click();
    await page.waitForLoadState("load");
    await expect(heading).toHaveText("Sin conexión");
    expect(new URL(page.url()).pathname).toBe("/es/notifications");

    // Evento `online`: recarga la URL que falló, ya con la página de verdad.
    await goOnline(context);
    await expect(page.getByRole("button", { name: "Reintentar" })).toHaveCount(0);
    await expect(heading).not.toHaveText("Sin conexión");
    expect(new URL(page.url()).pathname).toBe("/es/notifications");
  });

  test("Cache Storage nunca guarda HTML de páginas ni /api/*", async ({ page }) => {
    await boot(page);
    for (const path of ["/es/library", "/es/discover", "/es/lists", "/es/u/benevi"]) {
      await page.goto(path, { waitUntil: "networkidle" }).catch(() => undefined);
    }
    const contents = await cacheContents(page);
    for (const [name, paths] of Object.entries(contents)) {
      for (const p of paths) {
        if (name.startsWith("kultura-offline-")) expect(p).toMatch(/^\/(es|en)\/offline$/);
        else expect(p, `${name}: ${p}`).toMatch(/^\/_next\/static\//);
      }
    }
  });

  test("instalable: Chrome no pone pegas (Page.getInstallabilityErrors)", async ({ page }) => {
    await boot(page);
    const cdp = await page.context().newCDPSession(page);
    const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
    expect(installabilityErrors).toEqual([]);
    const manifest = await (await page.request.get("/manifest.webmanifest")).json();
    expect(manifest.share_target.action).toBe("/es/share");
  });
});

test.describe("accesibilidad", () => {
  for (const path of ["/es/offline", "/en/offline"]) {
    test(`axe en ${path}`, async ({ page }) => {
      await open(page, path);
      await expect(page.locator("main")).toHaveCount(1);
      await expectNoBlockingViolations(page, path);
    });
  }

  test("axe en el aviso de instalación (iOS, sin evento del navegador)", async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL,
      serviceWorkers: "block",
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      viewport: { width: 390, height: 844 },
    });
    await isolateNetwork(context);
    await signIn(context, baseURL!);
    const page = await context.newPage();
    await open(page, "/es/library");
    await expect(page.getByRole("complementary", { name: "Añade KULTURA a tu pantalla de inicio" })).toBeVisible();
    await expectNoBlockingViolations(page, "aviso de instalación", '[data-testid="install-prompt"]');
    await context.close();
  });
});

test.describe("aviso de instalación", () => {
  // Sin worker: las peticiones que pasan por él no se ven desde la página, y
  // aquí se mira el beacon de `appinstalled`.
  test.use({ serviceWorkers: "block" });

  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL!);
  });

  /** Chrome headless no lanza `beforeinstallprompt`: se simula uno. */
  async function fakeInstallPrompt(page: Page) {
    await page.evaluate(() => {
      const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & Record<string, unknown>;
      event.prompt = async () => undefined;
      event.userChoice = Promise.resolve({ outcome: "accepted" });
      window.dispatchEvent(event);
    });
  }

  test("2.ª visita: sale; «Ahora no» lo calla 30 días; después vuelve", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-11-01T10:00:00+01:00") });
    await page.goto("/es/home");
    await fakeInstallPrompt(page);
    await expect(page.getByTestId("install-prompt")).toHaveCount(0); // 1.ª visita

    await page.clock.setSystemTime(new Date("2026-11-01T12:00:00+01:00"));
    await page.reload();
    await fakeInstallPrompt(page);
    const card = page.getByRole("complementary", { name: "Instala KULTURA" });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Ahora no" }).click();
    await expect(card).toHaveCount(0);

    await page.clock.setSystemTime(new Date("2026-11-20T12:00:00+01:00"));
    await page.reload();
    await fakeInstallPrompt(page);
    await expect(page.getByTestId("install-prompt")).toHaveCount(0);

    await page.clock.setSystemTime(new Date("2026-12-02T12:00:00+01:00"));
    await page.reload();
    await fakeInstallPrompt(page);
    await expect(page.getByTestId("install-prompt")).toBeVisible();
  });

  test("appinstalled se registra en /api/pwa/installed", async ({ page }) => {
    await page.goto("/es/library", { waitUntil: "networkidle" });
    const request = page.waitForRequest((r) => r.url().endsWith("/api/pwa/installed") && r.method() === "POST");
    await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
    const sent = await request;
    expect(JSON.parse(sent.postData() ?? "{}")).toEqual({ platform: "desktop", source: "browser" });
    const res = await sent.response();
    expect([204, 403]).toContain(res?.status()); // 204, o 403 si el entorno es la demo
  });
});
