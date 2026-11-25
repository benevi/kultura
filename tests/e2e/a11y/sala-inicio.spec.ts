/**
 * Inicio con «Sala» (fase 8.5 I1): el `h1` y las filas de obras con
 * `SalaWorkList`/`SalaWorkCard` («Continúa donde lo dejaste», «Popular entre
 * tus amigos» y novedades). El hero, «Esta noche», «Para ti» y la actividad
 * siguen como hoy (I2). La red arranca con `SALA_INICIO=prueba` (`env.cjs`) y
 * este spec entra con la cookie de prueba; con `SALA_INICIO=1` también pasa
 * (salvo el caso «sin cookie»).
 *
 * Datos (`fixtures.cjs`): el manga en curso es el hero y Elden Ring
 * (pendiente) va en «Continúa». Las dos rutas que Inicio pide desde el
 * navegador (`/api/popular-in-circle`, `/api/genre-news`) se simulan aquí.
 */
import { test, expect, type BrowserContext, type Page, type Route } from "@playwright/test";
import { expectNoBlockingViolations, expectNoHorizontalScroll, isolateNetwork, open, signIn, walkTab } from "./helpers";
import es from "../../../messages/es.json";

const HOME = "[data-sala-home]";
const ROW = (name: string) => `[data-sala-home-row="${name}"]`;

async function salaCookie(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    { name: "kultura_sala_prueba", value: "1", domain: new URL(baseURL).hostname, path: "/", httpOnly: true, sameSite: "Lax" },
  ]);
}

/** Ocho novedades de cine (una sin portada) y dos series, con géneros. */
const NEWS = {
  movies: Array.from({ length: 10 }, (_, i) => ({
    id: `movie_${9000 + i}`,
    externalId: String(9000 + i),
    type: "movie",
    title: i === 0 ? "Una novedad sin portada" : `Novedad ${i}`,
    year: 2026,
    poster: i === 0 ? null : `https://image.tmdb.org/t/p/w500/n${i}.jpg`,
  })),
  tv: [
    { id: "tv_9100", externalId: "9100", type: "tv", title: "Serie nueva", year: 2026, poster: "https://image.tmdb.org/t/p/w500/s.jpg" },
  ],
  genres: ["Drama", "Comedia"],
};

const CIRCLE = [
  { mediaId: "movie_550", title: "El club de la lucha", poster: null, type: "movie", year: 1999, friendCount: 1, friendNames: ["lucia_lee"] },
];

async function json(route: Route, data: unknown) {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data }) });
}

async function mockHome(page: Page, { circle = CIRCLE as unknown[], news = NEWS as unknown } = {}) {
  await page.route("**/api/popular-in-circle", (route) => json(route, circle));
  await page.route("**/api/genre-news", (route) => json(route, news));
}

async function openHome(page: Page) {
  await open(page, "/es/home");
  await expect(page.locator(HOME)).toBeVisible();
  await expect(page.locator(ROW("news-0")).getByRole("listitem").first()).toBeVisible();
}

test.beforeEach(async ({ context, baseURL }) => {
  await isolateNetwork(context);
  await signIn(context, baseURL!);
});

test.describe("sin la cookie de prueba", () => {
  test.skip(process.env.SALA_INICIO === "1", "con SALA_INICIO=1 la ven todos");

  test("Inicio de hoy, sin «Sala» ni sus hojas", async ({ page }) => {
    await open(page, "/es/home");
    await expect(page.locator(HOME)).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: es.home.continueWatching })).toBeVisible();
    const salaSheets = await page.$$eval('link[rel="stylesheet"]', (links) =>
      links.map((l) => (l as HTMLLinkElement).href).filter((href) => /sala/i.test(href))
    );
    expect(salaSheets, "hojas de «Sala» en Inicio de hoy").toEqual([]);
  });
});

test.describe("con «Sala»", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await salaCookie(context, baseURL!);
  });

  test("un h1, filas con nombre, un enlace por obra y axe limpio", async ({ page }) => {
    await mockHome(page);
    await openHome(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(es.home.title);

    const cont = page.getByRole("list", { name: es.home.continueWatching, exact: true });
    await expect(cont.getByRole("link", { name: "Elden Ring", exact: true })).toBeVisible();
    await expect(cont.getByRole("heading", { level: 3, name: "Elden Ring", exact: true })).toBeVisible();
    await expect(cont.getByRole("listitem").first()).toContainText("Videojuego");

    const news = page.getByRole("list", { name: "Novedades en Drama", exact: true });
    await expect(news.getByRole("listitem")).toHaveCount(8);
    await expect(page.getByRole("list", { name: "Series en Comedia", exact: true }).getByRole("listitem")).toHaveCount(1);
    const circle = page.getByRole("list", { name: es.home.popularInCircle, exact: true });
    await expect(circle.getByRole("link", { name: "El club de la lucha", exact: true })).toBeVisible();

    // Cada fila anuncia, al acabar de cargar, cuántas obras trae.
    await expect(page.locator(`${ROW("news-0")} [data-sala-list-status]`)).toHaveText("8 obras");
    await expectNoBlockingViolations(page, "Inicio con «Sala»");
  });

  test("imagen rota: las obras sin portada ya no se esconden, salen con su campo de color", async ({ page }) => {
    await mockHome(page);
    await openHome(page);
    const sin = page.locator(ROW("news-0")).getByRole("listitem").filter({ hasText: "Una novedad sin portada" });
    await expect(sin).toBeVisible();
    await expect(sin.locator("img")).toHaveCount(0);
    const circle = page.locator(ROW("circle")).getByRole("listitem").filter({ hasText: "El club de la lucha" });
    await expect(circle.locator("img")).toHaveCount(0);
  });

  test("«Popular entre tus amigos» vacío: dice qué habrá y lleva a Amigos", async ({ page }) => {
    await mockHome(page, { circle: [] });
    await openHome(page);
    const row = page.locator(ROW("circle"));
    await expect(row.getByRole("heading", { level: 3, name: es.home.noFriends })).toBeVisible();
    await expect(row.getByRole("link", { name: es.home.addFriends })).toHaveAttribute("href", "/es/friends");
    await expect(row.getByRole("list")).toBeHidden();
    await expectNoBlockingViolations(page, "Inicio con «Sala», sin amigos");
  });

  test("teclado: la fila sigue al foco, el anillo se ve entero y la barra de la fila está a la vista", async ({ page }) => {
    await mockHome(page);
    await openHome(page);
    const list = page.getByRole("list", { name: "Novedades en Drama", exact: true });
    expect(await list.evaluate((el) => getComputedStyle(el).scrollbarWidth), "la barra de la fila no se esconde").not.toBe("none");

    const last = list.getByRole("link", { name: "Novedad 7", exact: true });
    await last.focus();
    const m = await last.evaluate((el) => {
      const ul = el.closest("ul")!;
      const after = getComputedStyle(el, "::after");
      const card = el.closest("[data-sala-card]")!.getBoundingClientRect();
      const box = ul.getBoundingClientRect();
      const ring = parseFloat(after.outlineWidth) + parseFloat(after.outlineOffset);
      return {
        scrolled: ul.scrollLeft,
        ring: (after.outlineStyle !== "none" && parseFloat(after.outlineWidth) > 0) || after.boxShadow !== "none",
        // El anillo (fuera de la tarjeta) cabe dentro de la caja de la fila.
        fits: card.left - ring >= box.left - 0.5 && card.right + ring <= box.right + 0.5 && card.top - ring >= box.top - 0.5,
      };
    });
    expect(m.scrolled, "la fila se desliza hasta la tarjeta enfocada").toBeGreaterThan(0);
    expect(m.ring, "la tarjeta enfocada lleva su anillo").toBe(true);
    expect(m.fits, "el anillo de foco no queda cortado por la fila").toBe(true);

    // Todo se alcanza con Tab, a la vista y con foco visible (las tarjetas llevan el anillo en `::after`).
    const stops = await walkTab(page, 80);
    const titles = new Set(await page.locator(`${HOME} [data-sala-card] a`).allTextContents());
    const bad = stops.filter((s) => !s.visible || (!s.indicator && !(s.tag === "a" && titles.has(s.name))));
    expect(bad, "paradas tapadas o sin foco visible").toEqual([]);
    expect(stops.some((s) => s.name === "Elden Ring"), JSON.stringify(stops)).toBe(true);
  });

  for (const width of [320, 375]) {
    test(`${width} px: sin scroll horizontal, axe limpio y objetivos de 44 px o más`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await mockHome(page, { circle: [] });
      await openHome(page);
      await expectNoHorizontalScroll(page, width);
      const small = await page.$$eval(`${HOME} [data-sala-home-row] button, ${HOME} [data-sala-home-row] a`, (els) =>
        els
          .filter((el) => !el.closest("[data-sala-card]") && (el as HTMLElement).offsetParent !== null)
          .map((el) => ({ text: el.textContent?.trim(), h: el.getBoundingClientRect().height }))
          .filter((r) => r.h < 44)
      );
      expect(small, "controles de menos de 44 px").toEqual([]);
      // Las tarjetas: toda la tarjeta se pulsa (el enlace la cubre).
      const card = await page.locator(`${ROW("news-0")} [data-sala-card]`).first().boundingBox();
      expect(card!.height).toBeGreaterThanOrEqual(48);
      await expectNoBlockingViolations(page, `Inicio con «Sala» a ${width} px`);
    });
  }

  test("movimiento reducido: los esqueletos de carga, quietos", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    let release: () => void = () => undefined;
    const held = new Promise<void>((r) => (release = r));
    await page.route("**/api/popular-in-circle", (route) => json(route, CIRCLE));
    await page.route("**/api/genre-news", async (route) => {
      await held;
      await json(route, NEWS);
    });
    await page.goto("/es/home", { waitUntil: "domcontentloaded" });
    const skeleton = page.locator(`${ROW("news-0")} [data-sala-card-skeleton]`).first();
    await expect(skeleton).toBeAttached();
    expect(await skeleton.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
    await expect(page.locator(`${ROW("news-0")} [data-sala-list-status]`)).toHaveText(es.home.sala.loading.replace("{title}", es.home.trends));
    release();
    await expect(page.getByRole("list", { name: "Novedades en Drama", exact: true }).getByRole("listitem")).toHaveCount(8);
  });
});
