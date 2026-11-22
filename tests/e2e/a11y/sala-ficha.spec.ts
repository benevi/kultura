/**
 * Ficha con «Sala» (fase 8.5, F2c): la mitad de abajo (más acciones, «Dónde
 * ver», Steam, fuentes). La red arranca con `SALA_FICHA=prueba` (`env.cjs`) y
 * este spec entra con la cookie de prueba; con `SALA_FICHA=1` también pasa.
 *
 * Datos (`fixtures.cjs`): 550 tiene «Dónde ver» con la página de TMDB (cada
 * plataforma es un enlace); 603, sin ella (la fila no tiene enlaces).
 */
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { isolateNetwork, signIn, open, expectNoBlockingViolations, expectNoHorizontalScroll } from "./helpers";

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

test("«Dónde ver» sin enlaces: la fila recibe el foco y se mueve con las flechas", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await open(page, "/es/media/movie/603");
  const row = page.locator(ROW);
  await expect(row).toHaveAttribute("tabindex", "0");
  await expect(row).toHaveAttribute("role", "group");
  await expect(row).toHaveAccessibleName("Dónde ver");
  await expect(row.locator("a")).toHaveCount(0);

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
  expect(overflow, "la fila desborda a 320 px").toBeGreaterThan(0);

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

test.describe("diálogos desde «Más acciones»: el foco entra y vuelve al botón", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL!);
  });

  for (const c of [
    { opener: "Añadir a lista", dialog: "Añadir a una lista" },
    { opener: "Recomendar", dialog: "Recomendar a un amigo" },
  ]) {
    test(c.opener, async ({ page }) => {
      await open(page, "/es/media/movie/550");
      const opener = page.locator("[data-sala-ficha-more-actions]").getByRole("button", { name: c.opener, exact: true });
      await opener.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: c.dialog });
      await expect(dialog).toBeVisible();
      await expect.poll(() => dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(opener).toBeFocused();
    });
  }

  test("Denunciar", async ({ page }) => {
    await open(page, "/es/media/movie/550");
    const opener = page.locator("[data-sala-ficha-more-actions]").getByRole("button", { name: "Denunciar", exact: true });
    await opener.focus();
    await page.keyboard.press("Enter");
    await expect(opener).toHaveAttribute("aria-expanded", "true");
    await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("type"))).toBe("radio");
    await page.keyboard.press("Escape");
    await expect(opener).toHaveAttribute("aria-expanded", "false");
    await expect(opener).toBeFocused();
  });
});
