/**
 * Ficha con «Sala» (fase 8.5, F2c): la mitad de abajo (más acciones, «Dónde
 * ver», Steam, fuentes). La red arranca con `SALA_FICHA=prueba` (`env.cjs`) y
 * este spec entra con la cookie de prueba; con `SALA_FICHA=1` también pasa.
 *
 * Datos (`fixtures.cjs`): 550 tiene «Dónde ver» con la página de TMDB (cada
 * plataforma es un enlace); 603, sin ella (la fila no tiene enlaces).
 */
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import {
  isolateNetwork,
  signIn,
  open,
  expectNoBlockingViolations,
  expectNoHorizontalScroll,
  expectSalaBodyOnGrid,
} from "./helpers";

async function salaCookie(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    { name: "kultura_sala_prueba", value: "1", domain: new URL(baseURL).hostname, path: "/", httpOnly: true, sameSite: "Lax" },
  ]);
}

test.beforeEach(async ({ context, baseURL }) => {
  await isolateNetwork(context);
  await salaCookie(context, baseURL!);
});

const ROW = "[data-sala-ficha-watch] [data-sala-watch-row]";

/** Lo que tiene el foco: anillo, caja con el anillo y la fila que lo contiene. */
async function focusState(page: Page) {
  return page.evaluate(async (rowSel) => {
    // Espera a que el desplazamiento termine (tres fotogramas iguales, ≤ 1,5 s).
    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
    const el = document.activeElement as HTMLElement;
    const row = document.querySelector(rowSel)!;
    let last = "";
    let stable = 0;
    const until = performance.now() + 1500;
    while (stable < 3 && performance.now() < until) {
      await frame();
      const key = `${row.scrollLeft},${window.scrollY},${el.getBoundingClientRect().left}`;
      stable = key === last ? stable + 1 : 0;
      last = key;
    }
    const s = getComputedStyle(el);
    const ring = s.outlineStyle !== "none" ? parseFloat(s.outlineWidth) + Math.max(0, parseFloat(s.outlineOffset) || 0) : 0;
    const r = el.getBoundingClientRect();
    const rr = row.getBoundingClientRect();
    return {
      name: el.getAttribute("aria-label") ?? "",
      inRow: row.contains(el),
      ring,
      left: r.left - ring,
      right: r.right + ring,
      top: r.top - ring,
      bottom: r.bottom + ring,
      rowLeft: Math.max(rr.left, 0),
      rowRight: Math.min(rr.right, window.innerWidth),
      vh: window.innerHeight,
    };
  }, ROW);
}

/** Ningún nombre de plataforma recortado (sin `line-clamp`, la tarjeta crece). */
async function expectNamesWhole(page: Page, label: string) {
  const clipped = await page.$$eval(`${ROW} li span`, (spans) =>
    spans
      .filter((s) => s.scrollHeight > s.clientHeight + 1 || s.scrollWidth > s.clientWidth + 1)
      .map((s) => s.textContent)
  );
  expect(clipped, `${label}: nombres recortados`).toEqual([]);
}

// El cuerpo de la sala en la retícula de la app (DIS-8) a cada ancho, en las
// dos fichas de prueba (con «Dónde ver» enlazado y sin enlaces).
for (const width of [390, 768, 1024, 1440]) {
  test(`cuerpo en la retícula a ${width} px`, async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!);
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/es/media/movie/550", "/es/media/movie/603"]) {
      await open(page, path);
      await expect(page.locator("[data-sala-ficha]").first()).toBeVisible();
      await expectSalaBodyOnGrid(page);
      await expectNoHorizontalScroll(page, width);
    }
  });
}

for (const scheme of ["light", "dark"] as const) {
  for (const session of [true, false]) {
    test(`axe en la mitad de abajo (${scheme}, ${session ? "con" : "sin"} sesión)`, async ({ page, context, baseURL }) => {
      if (session) await signIn(context, baseURL!);
      await page.emulateMedia({ colorScheme: scheme });
      await open(page, "/es/media/movie/550");
      await expect(page.locator("[data-sala-ficha-more]")).toBeVisible();
      await expect(page.locator(ROW)).toBeVisible();
      await expectNoBlockingViolations(page, `ficha Sala ${scheme}`, "[data-sala-ficha-more]");
    });
  }
}

test("rótulo con un título japonés: el h1 se llama como la obra, sin el espacio de los saltos", async ({ page }) => {
  const TITLE = "千と千尋の神隠し";
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await open(page, "/es/media/movie/129");
    const h1 = page.getByRole("heading", { level: 1 });
    // El rótulo parte el título en líneas (`<br>`); sin el texto oculto, Chromium metía un espacio.
    await expect(h1.locator("[data-sala-title-text] br").first()).toBeAttached();
    await expect(h1).toHaveAccessibleName(TITLE);
    await expect(h1.locator("[data-sala-title-text]")).toHaveAttribute("aria-hidden", "true");
  }
  await expectNoBlockingViolations(page, "Ficha con «Sala»: rótulo japonés");
});

test("«Dónde ver» con enlaces: Tab recorre la fila y el anillo se ve entero", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await open(page, "/es/media/movie/550");
  const links = page.locator(`${ROW} a`);
  const count = await links.count();
  expect(count, "plataformas con enlace").toBe(8);
  // Todo son enlaces: la fila no es otra parada.
  await expect(page.locator(ROW)).not.toHaveAttribute("tabindex");
  // Nombre con la modalidad: la misma plataforma está en alquiler y compra.
  await expect(links.first()).toHaveAttribute("aria-label", /^Amazon Prime Video, suscripción: dónde verlo/);
  await expect(page.locator(ROW).getByRole("link", { name: /^Apple TV, alquiler:/ })).toHaveCount(1);
  await expect(page.locator(ROW).getByRole("link", { name: /^Apple TV, compra:/ })).toHaveCount(1);

  // Al último enlace de antes de la fila y, desde ahí, con Tab.
  await links.first().focus();
  await page.keyboard.press("Shift+Tab");
  for (let i = 0; i < count; i++) {
    await page.keyboard.press("Tab");
    const f = await focusState(page);
    expect(f.inRow, `parada ${i + 1} dentro de la fila`).toBe(true);
    expect(f.ring, `${f.name}: anillo`).toBeGreaterThanOrEqual(2);
    expect(f.left, `${f.name}: anillo cortado a la izquierda`).toBeGreaterThanOrEqual(f.rowLeft - 0.5);
    expect(f.right, `${f.name}: anillo cortado a la derecha`).toBeLessThanOrEqual(f.rowRight + 0.5);
    expect(f.top, `${f.name}: arriba de la pantalla`).toBeGreaterThanOrEqual(0);
    expect(f.bottom, `${f.name}: debajo de la pantalla`).toBeLessThanOrEqual(f.vh);
  }
  await page.keyboard.press("Tab");
  expect((await focusState(page)).inRow, "tras la última plataforma, el foco sale de la fila").toBe(false);
});

test("«Dónde ver» a 320 px: los grupos van en varias líneas, sin fila que desplazar (F6)", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const path of ["/es/media/movie/550", "/es/media/movie/603"]) {
    await open(page, path);
    const row = page.locator(ROW);
    expect(await row.evaluate((el) => el.scrollWidth - el.clientWidth), `${path}: la fila no desborda`).toBeLessThanOrEqual(1);
  }
});

test("«Dónde ver» sin enlaces: la fila recibe el foco y se mueve con las flechas", async ({ page }) => {
  // Desde `sm` es una fila que se desliza; a 640 px, la de 603 desborda.
  await page.setViewportSize({ width: 640, height: 700 });
  await open(page, "/es/media/movie/603");
  const row = page.locator(ROW);
  await expect(row).toHaveAttribute("tabindex", "0");
  await expect(row).toHaveAttribute("role", "group");
  await expect(row).toHaveAccessibleName("Dónde ver");
  await expect(row.locator("a")).toHaveCount(0);
  // A 640 px la fila de 603 cabe: se ensanchan las tarjetas para que desborde.
  await page.addStyleTag({ content: `${ROW} li { width: 12rem !important; }` });

  // Llega con Tab desde lo anterior (foco de teclado, con anillo).
  await row.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(row).toBeFocused();
  const ring = await row.evaluate((el) => {
    const s = getComputedStyle(el);
    return s.outlineStyle !== "none" ? parseFloat(s.outlineWidth) : 0;
  });
  expect(ring, "anillo de la fila").toBeGreaterThanOrEqual(2);
  const overflow = await row.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow, "la fila desborda a 640 px").toBeGreaterThan(0);

  const before = await row.evaluate((el) => el.scrollLeft);
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => row.evaluate((el) => el.scrollLeft)).toBeGreaterThan(before);
  // Hasta el final con la flecha derecha y vuelta al principio con la izquierda.
  // (Inicio y Fin desplazan en vertical en Chrome, no en la fila.)
  for (let i = 0; i < 40; i++) await page.keyboard.press("ArrowRight");
  await expect.poll(() => row.evaluate((el) => Math.ceil(el.scrollLeft + el.clientWidth) >= el.scrollWidth)).toBe(true);
  for (let i = 0; i < 40; i++) await page.keyboard.press("ArrowLeft");
  await expect.poll(() => row.evaluate((el) => el.scrollLeft)).toBe(0);
});

test("320 px y espaciado de texto (1.4.10, 1.4.12): sin desbordes ni nombres recortados", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const path of ["/es/media/movie/550", "/es/media/movie/603"]) {
    await open(page, path);
    await expectNoHorizontalScroll(page, 320);
    await expectNamesWhole(page, path);
    // El marcador de WCAG 1.4.12.
    await page.addStyleTag({
      content:
        "* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }" +
        " p { margin-bottom: 2em !important; }",
    });
    await expectNoHorizontalScroll(page, 320);
    await expectNamesWhole(page, `${path} con espaciado`);
  }
});

test.describe("tráiler (F3): marco 16:9, nada de YouTube hasta pulsar", () => {
  const TRAILER = "[data-sala-ficha-trailer]";
  const NAME = "Reproducir el tráiler de El club de la lucha";

  /** Peticiones a YouTube (las corta `isolateNetwork`, pero se cuentan). */
  function watchYouTube(page: Page) {
    const hits: string[] = [];
    page.on("request", (r) => {
      if (/youtube|ytimg|googlevideo/.test(r.url())) hits.push(r.url());
    });
    return hits;
  }

  for (const scheme of ["light", "dark"] as const) {
    for (const width of [375, 1440]) {
      test(`antes de pulsar (${scheme}, ${width} px): marco 16:9 en la retícula, axe y sin YouTube`, async ({ page }) => {
        const hits = watchYouTube(page);
        await page.emulateMedia({ colorScheme: scheme });
        await page.setViewportSize({ width, height: 900 });
        await open(page, "/es/media/movie/550");
        const section = page.locator(TRAILER);
        await expect(section.getByRole("heading", { level: 2, name: "Tráiler" })).toBeVisible();
        await section.scrollIntoViewIfNeeded();
        const frame = await section.locator(".aspect-video").boundingBox();
        expect(frame, "marco").not.toBeNull();
        expect(Math.abs(frame!.width / frame!.height - 16 / 9), "proporción 16:9").toBeLessThan(0.02);
        await expect(section.locator("iframe")).toHaveCount(0);
        await expectSalaBodyOnGrid(page);
        await expectNoHorizontalScroll(page, width);
        await expectNoBlockingViolations(page, `tráiler Sala ${scheme} ${width}`, TRAILER);
        expect(hits, "peticiones a YouTube antes de pulsar").toEqual([]);
      });
    }
  }

  test("con el teclado: el botón dice qué tráiler, tiene anillo y al pulsar el foco pasa al reproductor", async ({ page }) => {
    const hits = watchYouTube(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, "/es/media/movie/550");
    const button = page.locator(TRAILER).getByRole("button", { name: NAME });
    await expect(button).toHaveAccessibleDescription("El vídeo se carga desde YouTube al pulsar.");
    // Llega con Tab (foco de teclado, con anillo visible).
    await button.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(button).toBeFocused();
    const ring = await button.evaluate((el) => {
      const s = getComputedStyle(el);
      return s.outlineStyle !== "none" ? parseFloat(s.outlineWidth) : 0;
    });
    expect(ring, "anillo del botón").toBeGreaterThanOrEqual(2);
    // Con movimiento reducido, sin transiciones.
    expect(await button.evaluate((el) => getComputedStyle(el).transitionProperty)).toBe("none");
    expect(hits).toEqual([]);

    await page.keyboard.press("Enter");
    const iframe = page.locator(`${TRAILER} iframe`);
    await expect(iframe).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/Kultura0550?autoplay=1&rel=0");
    await expect(iframe).toHaveAttribute("title", "Tráiler de El club de la lucha");
    await expect(iframe).toBeFocused();
    await expect(page.locator(TRAILER).getByRole("button")).toHaveCount(0);
    // Solo después de pulsar, y solo al dominio sin cookies.
    expect(hits.length).toBeGreaterThan(0);
    for (const url of hits) expect(url).toMatch(/^https:\/\/www\.youtube-nocookie\.com\//);
  });

  test("sin tráiler (603): ni sección ni encabezado", async ({ page }) => {
    await open(page, "/es/media/movie/603");
    await expect(page.locator("[data-sala-ficha-more]")).toBeVisible();
    await expect(page.locator(TRAILER)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Tráiler" })).toHaveCount(0);
  });
});

test.describe("diálogos desde «Más acciones» (SalaDialog, F2d): el foco entra, no sale y vuelve al botón", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL!);
  });

  for (const c of [
    { opener: "Añadir a lista", dialog: "Añadir a una lista" },
    { opener: "Recomendar", dialog: "Recomendar a un amigo" },
    { opener: "Denunciar", dialog: "Denunciar título" },
  ]) {
    for (const scheme of ["light", "dark"] as const) {
      test(`${c.opener} (${scheme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await open(page, "/es/media/movie/550");
        const opener = page.locator("[data-sala-ficha-list-actions], [data-sala-ficha-more-actions]").getByRole("button", { name: c.opener, exact: true });
        await expect(opener).toHaveAttribute("aria-haspopup", "dialog");
        await opener.focus();
        await page.keyboard.press("Enter");
        const dialog = page.getByRole("dialog", { name: c.dialog });
        await expect(dialog).toBeVisible();
        await expect(dialog).toHaveAttribute("data-sala-dialog", "sheet");
        await expect(dialog).toHaveAttribute("aria-modal", "true");
        const inside = () => dialog.evaluate((el) => el.contains(document.activeElement));
        await expect.poll(inside, { message: "el foco entra al abrir" }).toBe(true);
        for (let i = 0; i < 12; i++) {
          await page.keyboard.press("Tab");
          expect(await inside(), `Tab ${i + 1} sale del diálogo`).toBe(true);
        }
        await page.keyboard.press("Shift+Tab");
        expect(await inside(), "Mayús+Tab sale del diálogo").toBe(true);
        await expectNoBlockingViolations(page, `${c.dialog} Sala ${scheme}`, "[data-sala-dialog]");
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(opener).toBeFocused();
      });
    }
  }

  test("Añadir a lista: cuando llegan las listas, el foco pasa a la primera", async ({ page }) => {
    // Las listas tardan: al abrir, el foco está en «Cancelar»; al llegar, en la primera lista.
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route("**/api/lists", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await gate;
      await route.continue();
    });
    await open(page, "/es/media/movie/550");
    const opener = page.locator("[data-sala-ficha-list-actions]").getByRole("button", { name: "Añadir a lista", exact: true });
    await opener.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Añadir a una lista" });
    await expect(dialog.getByRole("button", { name: "Cancelar", exact: true })).toBeFocused();
    release();
    await expect(dialog.getByRole("radio", { name: "Pelis para el finde" })).toBeFocused();
  });

  test("Denunciar: el foco entra en el primer motivo y, sin motivo, el error lo dice el grupo", async ({ page }) => {
    await open(page, "/es/media/movie/550");
    const opener = page.locator("[data-sala-ficha-more-actions]").getByRole("button", { name: "Denunciar", exact: true });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: "Denunciar título" });
    const first = dialog.getByRole("radio", { name: "Acoso o intimidación" });
    await expect(first).toBeFocused();
    await dialog.getByRole("button", { name: "Enviar denuncia", exact: true }).click();
    await expect(dialog.getByRole("radiogroup", { name: "¿Por qué lo denuncias?" })).toHaveAttribute("aria-invalid", "true");
    await expect(first).toBeFocused();
    await expect(dialog).toBeVisible();
  });
});
