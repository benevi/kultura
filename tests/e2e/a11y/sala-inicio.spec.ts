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

/**
 * Fase 8.5 I2a: el hero «Continuando», las flechas de las filas en
 * escritorio, el aviso con «Reintentar» si una fila falla, «N amigos» y el
 * «+1» con su diálogo de terminar, todo en «Sala».
 */
test.describe("con «Sala» (I2a)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await salaCookie(context, baseURL!);
  });

  const SLIME = "転生したらスライムだった件";

  test("hero «Continuando»: encabezado con nombre, «Continuar» descrito por la obra, columna ancha y axe limpio", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockHome(page);
    await openHome(page);
    const hero = page.locator("[data-sala-home-hero]");
    const heading = hero.getByRole("heading", { level: 2 });
    await expect(heading).toHaveAccessibleName(`${es.home.continuing} ${SLIME}`);
    await expect(hero).toContainText(es.discoverFilters.typeBadge.manga);
    const cta = hero.getByRole("link", { name: es.home.continue, exact: true });
    await expect(cta).toHaveAttribute("href", "/es/media/manga/108556");
    await expect(cta).toHaveAccessibleDescription(`${es.home.continuing} ${SLIME}`);
    // Acciones de 48 px (biblia §9).
    for (const el of [cta, hero.getByTestId("progress-next")]) {
      expect((await el.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    }
    // Columna más ancha en escritorio (6xl, 72 rem; antes 4xl, 56 rem).
    expect((await hero.boundingBox())!.width).toBeGreaterThan(896);
    await expectNoBlockingViolations(page, "Inicio con «Sala»: hero");
  });

  test("«Popular entre tus amigos» dice cuántos amigos la tienen, con su plural", async ({ page }) => {
    await mockHome(page, {
      circle: [
        { ...CIRCLE[0], friendCount: 3 },
        { ...CIRCLE[0], mediaId: "movie_551", title: "Otra", friendCount: 1 },
      ],
    });
    await openHome(page);
    const items = page.getByRole("list", { name: es.home.popularInCircle, exact: true }).getByRole("listitem");
    await expect(items.nth(0)).toContainText("3 amigos");
    await expect(items.nth(1)).toContainText("1 amigo");
    await expect(items.nth(1)).not.toContainText("1 amigos");
  });

  test("flechas en escritorio: controlan la fila y se paran en los extremos sin perder el foco", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockHome(page);
    await openHome(page);
    const row = page.locator(ROW("news-0"));
    const list = page.getByRole("list", { name: "Novedades en Drama", exact: true });
    const prev = row.getByRole("button", { name: "Anteriores en «Novedades en Drama»" });
    const next = row.getByRole("button", { name: "Siguientes en «Novedades en Drama»" });
    const listId = await list.getAttribute("id");
    await expect(prev).toHaveAttribute("aria-controls", listId!);
    await expect(next).toHaveAttribute("aria-controls", listId!);
    for (const b of [prev, next]) {
      const box = (await b.boundingBox())!;
      expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(48);
    }

    // Ocho tarjetas de 160 px no caben en la columna: la fila se puede mover.
    await expect(prev).toHaveAttribute("aria-disabled", "true");
    await expect(next).not.toHaveAttribute("aria-disabled");
    await next.focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => list.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    // Al final, «Siguientes» queda desactivada y el foco sigue en ella.
    await expect(next).toHaveAttribute("aria-disabled", "true");
    await expect(next).toBeFocused();
    await expect(prev).not.toHaveAttribute("aria-disabled");
    await expectNoBlockingViolations(page, "Inicio con «Sala»: flechas");

    // En el móvil no hay flechas: la fila se desliza con el dedo.
    await page.setViewportSize({ width: 375, height: 800 });
    await expect(next).toBeHidden();
  });

  test("si una fila falla: aviso con «Reintentar» (role=alert) y, al reintentar, la fila", async ({ page }) => {
    let fail = true;
    await page.route("**/api/popular-in-circle", (route) =>
      fail
        ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "internal", message: "x" } }) })
        : json(route, CIRCLE)
    );
    await page.route("**/api/genre-news", (route) => json(route, NEWS));
    await openHome(page);
    const row = page.locator(ROW("circle"));
    const alert = row.getByRole("alert");
    await expect(alert).toContainText(`No se ha podido cargar «${es.home.popularInCircle}»`);
    const retry = alert.getByRole("button", { name: es.home.sala.retry });
    await expect(retry).toBeVisible();
    expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    await expect(row.getByRole("heading", { level: 2, name: es.home.popularInCircle })).toBeVisible();
    await expectNoBlockingViolations(page, "Inicio con «Sala»: fila con error");

    fail = false;
    await retry.click();
    await expect(row.getByRole("heading", { level: 2 })).toBeFocused();
    await expect(
      page.getByRole("list", { name: es.home.popularInCircle, exact: true }).getByRole("link", { name: "El club de la lucha" })
    ).toBeVisible();
    await expect(alert).toBeEmpty();
  });

  test("«+1» del hero y, al llegar al final, el diálogo de «Sala» con Cancelar primero", async ({ page }) => {
    await mockHome(page);
    await page.route("**/api/library/progress", (route) =>
      json(route, { progress: { chapter: 35, volume: 5 }, status: "in_progress", caughtUp: false, finished: true, diary: false })
    );
    await openHome(page);
    const hero = page.locator("[data-sala-home-hero]");
    await hero.getByTestId("progress-next").click();
    const dialog = page.getByRole("alertdialog", { name: `¿Has terminado «${SLIME}»?` });
    await expect(dialog).toBeVisible();
    const buttons = dialog.getByRole("button");
    await expect(buttons).toHaveCount(2);
    await expect(buttons.nth(0)).toHaveText(es.progress.finishCancel);
    await expect(buttons.nth(0)).toBeFocused();
    await expectNoBlockingViolations(page, "Inicio con «Sala»: diálogo de terminar");
    // Enter recién abierto cancela: no completa nada.
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    await expect(hero.getByTestId("progress-label")).toContainText("35");
  });
});
