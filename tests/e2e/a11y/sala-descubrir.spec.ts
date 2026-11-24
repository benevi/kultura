/**
 * Descubrir con «Sala» (fase 8.5 D1): buscador, tipos, «Sorpréndeme», la
 * rejilla de `SalaWorkCard` y la paginación. La red arranca con
 * `SALA_DESCUBRIR=prueba` (`env.cjs`) y este spec entra con la cookie de
 * prueba; con `SALA_DESCUBRIR=1` también pasa (salvo el caso «sin cookie»).
 *
 * Datos: `/api/discover` se contesta desde aquí (`page.route`), así el spec
 * no depende de los datos simulados de TMDB y puede provocar el error. Tres
 * obras: Matrix (con portada), una sin portada y otra cuya portada falla.
 */
import { test, expect, type BrowserContext, type Page, type Route } from "@playwright/test";
import { expectNoBlockingViolations, expectNoHorizontalScroll, isolateNetwork, open, signIn, walkTab } from "./helpers";
import es from "../../../messages/es.json";

const VIEW = "[data-sala-discover]";
const GRID = es.discover.sala.gridLabel;
const BROKEN = "https://image.tmdb.org/t/p/w500/rota.jpg";

const ITEMS = [
  { id: "movie_603", externalId: "603", type: "movie", title: "Matrix", year: 1999, poster: "https://image.tmdb.org/t/p/w500/matrix.jpg" },
  { id: "movie_1", externalId: "1", type: "movie", title: "Una película sin portada", year: 2001 },
  { id: "movie_2", externalId: "2", type: "movie", title: "La portada que falla", year: 2002, poster: BROKEN },
];

async function salaCookie(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    { name: "kultura_sala_prueba", value: "1", domain: new URL(baseURL).hostname, path: "/", httpOnly: true, sameSite: "Lax" },
  ]);
}

/** Contesta `/api/discover`: con búsqueda, solo Matrix; con `fail`, un 500. */
async function mockDiscover(page: Page, opts: { fail?: () => boolean; hasMore?: boolean } = {}) {
  await page.route("**/api/discover?**", (route: Route) => {
    if (opts.fail?.()) return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "internal" } }) });
    const q = new URL(route.request().url()).searchParams.get("q");
    const items = q ? ITEMS.filter((i) => i.title.toLowerCase().includes(q.toLowerCase())) : ITEMS;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { items, hasMore: opts.hasMore ?? false, totalPages: opts.hasMore ? 4 : 1, fetchErrorKind: null } }),
    });
  });
  // La portada que falla: 404 (las demás reciben el píxel de `isolateNetwork`).
  await page.route(/rota\.jpg/, (route) => route.fulfill({ status: 404, body: "" }));
}

test.beforeEach(async ({ context, baseURL }) => {
  await isolateNetwork(context);
  await signIn(context, baseURL!);
});

test.describe("sin la cookie de prueba", () => {
  test.skip(process.env.SALA_DESCUBRIR === "1", "con SALA_DESCUBRIR=1 la ven todos");

  test("Descubrir de hoy, sin «Sala» ni sus hojas", async ({ page }) => {
    await mockDiscover(page);
    await open(page, "/es/discover");
    await expect(page.locator(VIEW)).toHaveCount(0);
    await expect(page.getByRole("radiogroup", { name: es.filters.type })).toBeVisible();
    const salaSheets = await page.$$eval('link[rel="stylesheet"]', (links) =>
      links.map((l) => (l as HTMLLinkElement).href).filter((href) => /sala/i.test(href))
    );
    expect(salaSheets, "hojas de «Sala» en Descubrir de hoy").toEqual([]);
  });
});

test.describe("con «Sala»", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await salaCookie(context, baseURL!);
  });

  async function openDiscover(page: Page, path = "/es/discover") {
    await open(page, path);
    await expect(page.locator(VIEW)).toBeVisible();
  }

  test("rejilla: un h1, lista con nombre, un enlace por obra y axe limpio", async ({ page }) => {
    await mockDiscover(page);
    await openDiscover(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(es.discover.title);
    const list = page.getByRole("list", { name: GRID });
    await expect(list.getByRole("listitem")).toHaveCount(3);
    for (const item of ITEMS) {
      await expect(list.getByRole("link", { name: item.title, exact: true })).toBeVisible();
      await expect(list.getByRole("heading", { level: 2, name: item.title, exact: true })).toBeVisible();
    }
    await expect(list.getByRole("listitem").first()).toContainText("Película");
    await expectNoBlockingViolations(page, "Descubrir con «Sala»");
  });

  test("imagen rota: sin portada o si falla, el campo de color con el título, nunca el icono roto", async ({ page }) => {
    await mockDiscover(page);
    await openDiscover(page);
    const list = page.getByRole("list", { name: GRID });
    const sinPortada = list.getByRole("listitem").filter({ hasText: "Una película sin portada" });
    await expect(sinPortada.locator("img")).toHaveCount(0);
    // La que falla: la imagen se quita de en medio (o queda invisible) y se ve el rótulo.
    const falla = list.getByRole("listitem").filter({ hasText: "La portada que falla" });
    await expect
      .poll(() =>
        falla.locator("[data-sala-card] > div").first().evaluate((box) => {
          const img = box.querySelector("img");
          return !img || getComputedStyle(img).visibility === "hidden" || getComputedStyle(img).opacity === "0" || img.offsetParent === null;
        })
      )
      .toBe(true);
    // Matrix sí trae imagen.
    await expect(list.getByRole("listitem").filter({ hasText: "Matrix" }).locator("img")).toHaveCount(1);
  });

  test("búsqueda: etiqueta a la vista, una sola ×, resultados anunciados y el foco en el campo", async ({ page }) => {
    await mockDiscover(page);
    await openDiscover(page);
    // La navegación lenta (como en CI) pinta `loading.tsx` y vuelve a montar la
    // vista: se fuerza siempre, para probar que el foco vuelve al campo.
    await page.route("**/es/discover?**", async (route) => {
      if (route.request().headers()["rsc"]) await new Promise((r) => setTimeout(r, 1500));
      await route.fallback();
    });
    const search = page.getByRole("search");
    const input = search.getByRole("combobox", { name: es.discover.sala.searchLabel });
    await expect(search.getByText(es.discover.sala.searchLabel, { exact: true })).toBeVisible();
    await input.fill("matrix");
    await input.press("Enter");
    await expect(page).toHaveURL(/[?&]q=matrix/);
    await expect(page.getByRole("list", { name: GRID }).getByRole("listitem")).toHaveCount(1);
    await expect(page.locator("[data-sala-list-status]")).toHaveText("1 obra");
    await expect(input, "el campo no se vuelve a montar: el foco sigue en él").toBeFocused();
    await expect(page.getByText("Resultados para «matrix»")).toBeVisible();
    // Una sola × en toda la página: la de borrar, dentro del buscador.
    await expect(page.getByRole("button", { name: es.discover.sala.clearSearch })).toHaveCount(1);
    await expect(page.getByRole("button", { name: es.filters.reset })).toHaveCount(0);
    await expectNoBlockingViolations(page, "Descubrir con una búsqueda");

    await search.getByRole("button", { name: es.discover.sala.clearSearch }).click();
    await expect(page).not.toHaveURL(/q=/);
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("");
    await expect(page.getByRole("list", { name: GRID }).getByRole("listitem")).toHaveCount(3);
  });

  test("error: se anuncia en una región alert y «Reintentar» lo arregla", async ({ page }) => {
    let failing = true;
    await mockDiscover(page, { fail: () => failing });
    await openDiscover(page);
    const alert = page.getByRole("alert").filter({ hasText: es.discover.sala.errorTitle });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(es.discover.fetchError.generic);
    await expectNoBlockingViolations(page, "Descubrir con error");
    failing = false;
    await alert.getByRole("button", { name: es.discover.sala.retry }).click();
    await expect(page.getByRole("list", { name: GRID }).getByRole("listitem")).toHaveCount(3);
    await expect(page.getByRole("alert").filter({ hasText: es.discover.sala.errorTitle })).toHaveCount(0);
  });

  test("aria-pressed: los tipos y «Sorpréndeme», que se apaga pulsándolo otra vez", async ({ page }) => {
    await mockDiscover(page);
    await openDiscover(page, "/es/discover?type=movie");
    const types = page.getByRole("group", { name: es.filters.type, exact: true });
    await expect(types.getByRole("button", { name: es.filters.movie, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(types.getByRole("button", { name: es.filters.tv, exact: true })).toHaveAttribute("aria-pressed", "false");

    const random = page.getByRole("button", { name: es.search.randomize, exact: true });
    await expect(random).toHaveAttribute("aria-pressed", "false");
    await random.focus();
    await page.keyboard.press("Enter");
    await expect(random).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("list", { name: GRID }).getByRole("listitem")).toHaveCount(1);
    await expect(page.getByRole("status").filter({ hasText: "1 resultado aleatorio de 3" })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(random).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("list", { name: GRID }).getByRole("listitem")).toHaveCount(3);

    await types.getByRole("button", { name: es.filters.tv, exact: true }).click();
    await expect(page).toHaveURL(/[?&]type=tv/);
  });

  test("teclado: todo se alcanza con Tab, a la vista y con foco visible", async ({ page }) => {
    await mockDiscover(page, { hasMore: true });
    await openDiscover(page);
    const stops = await walkTab(page, 60);
    const inView = stops.filter((s) => ["Matrix", es.discover.sala.searchLabel, es.search.randomize, es.discover.next].some((n) => s.name.includes(n)) || s.tag === "input");
    expect(inView.length, JSON.stringify(stops)).toBeGreaterThanOrEqual(3);
    // El anillo de las tarjetas va en el `::after` del enlace (cubre la tarjeta entera): se mide aparte.
    const titles = ITEMS.map((i) => i.title);
    const bad = stops.filter((s) => !s.visible || (!s.indicator && !(s.tag === "a" && titles.includes(s.name))));
    expect(bad, "paradas tapadas o sin foco visible").toEqual([]);
    const link = page.getByRole("link", { name: "Matrix", exact: true });
    await link.focus();
    const ring = await link.evaluate((el) => {
      const after = getComputedStyle(el, "::after");
      return (after.outlineStyle !== "none" && parseFloat(after.outlineWidth) > 0) || (after.boxShadow !== "none" && after.boxShadow !== "");
    });
    expect(ring, "la tarjeta enfocada lleva su anillo").toBe(true);
  });

  test("320 px: sin scroll horizontal y objetivos de 44 px o más", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await mockDiscover(page, { hasMore: true });
    await openDiscover(page);
    await expectNoHorizontalScroll(page, 320);
    const small = await page.$$eval(`${VIEW} button, ${VIEW} input`, (els) =>
      els
        // Los filtros siguen siendo los de hoy hasta D2.
        .filter((el) => !el.closest('[role="group"]:not([aria-labelledby])') && (el as HTMLElement).offsetParent !== null)
        .map((el) => ({ text: el.textContent?.trim() || el.getAttribute("aria-label"), h: el.getBoundingClientRect().height, w: el.getBoundingClientRect().width }))
        .filter((r) => r.h < 44 || r.w < 44)
    );
    expect(small, "controles de menos de 44 px").toEqual([]);
  });

  test("movimiento reducido: los esqueletos de carga, quietos", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    let release: () => void = () => undefined;
    const held = new Promise<void>((r) => (release = r));
    await page.route("**/api/discover?**", async (route) => {
      await held;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { items: ITEMS, hasMore: false, totalPages: 1, fetchErrorKind: null } }) });
    });
    await page.goto("/es/discover", { waitUntil: "domcontentloaded" });
    const skeleton = page.locator("[data-sala-card-skeleton]").first();
    await expect(skeleton).toBeAttached();
    expect(await skeleton.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
    release();
    await expect(page.getByRole("list", { name: GRID }).getByRole("listitem")).toHaveCount(3);
  });
});
