/**
 * Listas con «Sala» (fase 8.5 L1): el índice `/lists` con una tarjeta por
 * lista (mosaico de cuatro casillas, el nombre como único enlace en un `h2` y
 * los datos con palabras), «Nueva lista» y el esqueleto. L2: «Crear lista» en
 * `SalaDialog`. La red arranca con
 * `SALA_LISTAS=prueba` (`env.cjs`) y este spec entra con la cookie de prueba;
 * con `SALA_LISTAS=1` también pasa (salvo el caso «sin cookie»).
 *
 * Datos (`fixtures.cjs`): `a11y_tester` tiene «Pelis para el finde»
 * (colaborativa, privada, dos títulos) y es miembro de «Ranking de terror», de
 * `lucia_lee` (colaborativa, privada, varios formatos, ranking, vacía). El
 * vacío del índice se prueba en `SalaListsIndex.test.tsx`: aquí quien mira
 * siempre tiene listas.
 */
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { expectNoBlockingViolations, expectNoHorizontalScroll, isolateNetwork, open, signIn, walkTab } from "./helpers";
import es from "../../../messages/es.json";

const INDEX = "[data-sala-lists]";

async function salaCookie(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    { name: "kultura_sala_prueba", value: "1", domain: new URL(baseURL).hostname, path: "/", httpOnly: true, sameSite: "Lax" },
  ]);
}

async function openIndex(page: Page) {
  await open(page, "/es/lists");
  await expect(page.locator(INDEX)).toBeVisible();
}

test.beforeEach(async ({ context, baseURL }) => {
  await isolateNetwork(context);
  await signIn(context, baseURL!);
});

test.describe("sin la cookie de prueba", () => {
  test.skip(process.env.SALA_LISTAS === "1", "con SALA_LISTAS=1 la ven todos");

  test("el índice de hoy, sin «Sala» ni sus hojas", async ({ page }) => {
    await open(page, "/es/lists");
    await expect(page.locator(INDEX)).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(es.lists.title);
    await expect(page.getByRole("heading", { level: 3, name: "Pelis para el finde" })).toBeVisible();
    const salaSheets = await page.$$eval('link[rel="stylesheet"]', (links) =>
      links.map((l) => (l as HTMLLinkElement).href).filter((href) => /sala/i.test(href))
    );
    expect(salaSheets, "hojas de «Sala» en el índice de hoy").toEqual([]);
  });
});

test.describe("con la cookie de prueba", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await salaCookie(context, baseURL!);
  });

  test("una tarjeta por lista, con su `h2`, su enlace y sus datos con palabras", async ({ page }) => {
    await openIndex(page);
    await expect(page.getByRole("heading", { level: 1, name: es.lists.title })).toBeVisible();
    const cards = page.locator(`${INDEX} [data-sala-card="list"]`);
    await expect(cards).toHaveCount(2);

    const propia = cards.filter({ hasText: "Pelis para el finde" });
    await expect(propia.getByRole("heading", { level: 2 })).toHaveText("Pelis para el finde");
    await expect(propia.getByRole("link")).toHaveCount(1);
    await expect(propia.getByRole("link")).toHaveAttribute("href", /\/es\/lists\/00000000-0000-4000-8000-0000000000a1$/);
    // A la vista, «película · 2 títulos · privada»; el lector oye comas (el punto va oculto).
    for (const dato of [es.discoverFilters.typeBadge.movie.toLowerCase(), "2 títulos", es.lists.visibilityPrivate.toLowerCase()]) {
      await expect(propia).toContainText(dato);
    }
    await expect(propia).toContainText(es.lists.sala.collaborative);
    await expect(propia).not.toContainText("de @");
    await expect(propia.locator("[data-sala-list-mosaic] > *")).toHaveCount(4);

    const ajena = cards.filter({ hasText: "Ranking de terror" });
    await expect(ajena).toContainText(es.lists.mediaTypeMixed.toLowerCase());
    await expect(ajena).toContainText("0 títulos");
    await expect(ajena).toContainText(es.lists.template.ranking.toLowerCase());
    await expect(ajena).toContainText("de @lucia_lee");

    await expectNoBlockingViolations(page, "Listas con «Sala»");
  });

  test("«Nueva lista» abre «Crear lista» en «Sala»: foco en el nombre, axe limpio y Escape devuelve el foco (L2)", async ({ page }) => {
    await openIndex(page);
    const nueva = page.getByRole("button", { name: es.lists.newList });
    await nueva.click();
    const dialog = page.getByRole("dialog", { name: es.lists.createList });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-testid="sala-create-list-form"]')).toBeVisible();
    await expect(page.getByRole("textbox", { name: es.lists.listName })).toBeFocused();
    await expect(page.getByRole("radio", { name: new RegExp(es.lists.visibilityPrivate) })).toBeChecked();
    await expectNoBlockingViolations(page, "Crear lista con «Sala»");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(nueva).toBeFocused();
  });

  test("«Crear lista»: sin nombre, el error en el campo y el foco en él; «Franquicia» fija el formato (L2)", async ({ page }) => {
    await openIndex(page);
    await page.getByRole("button", { name: es.lists.newList }).click();
    const dialog = page.getByRole("dialog", { name: es.lists.createList });
    await dialog.getByRole("button", { name: es.lists.create, exact: true }).click();
    const field = page.getByRole("textbox", { name: es.lists.listName });
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toBeFocused();
    await expect(dialog).toContainText(es.lists.nameRequired);
    await dialog.getByRole("radio", { name: new RegExp(es.lists.template.franchise) }).check();
    await expect(dialog.getByRole("combobox", { name: es.lists.mediaType })).toHaveCount(0);
    await expect(dialog).toContainText(es.lists.mediaTypeMixed);
    await expectNoBlockingViolations(page, "Crear lista con error con «Sala»");
  });

  for (const width of [320, 375]) {
    test(`${width} px: «Crear lista» como hoja, sin scroll horizontal y con «Crear» de 44 px o más (L2)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await openIndex(page);
      await page.getByRole("button", { name: es.lists.newList }).click();
      const dialog = page.getByRole("dialog", { name: es.lists.createList });
      await expect(dialog).toBeVisible();
      await expectNoHorizontalScroll(page, width);
      const crear = await dialog.getByRole("button", { name: es.lists.create, exact: true }).boundingBox();
      expect(crear!.height).toBeGreaterThanOrEqual(44);
      await expectNoBlockingViolations(page, `Crear lista con «Sala» a ${width} px`);
    });
  }

  test("teclado: cada parada a la vista y con foco visible; las listas, alcanzables", async ({ page }) => {
    await openIndex(page);
    const stops = await walkTab(page, 40);
    const titles = new Set(await page.locator(`${INDEX} [data-sala-card] a`).allTextContents());
    // Las tarjetas llevan el anillo en `::after` (cubre la tarjeta): `walkTab` no lo ve en el enlace.
    const bad = stops.filter((s) => !s.visible || (!s.indicator && !(s.tag === "a" && titles.has(s.name))));
    expect(bad, "paradas tapadas o sin foco visible").toEqual([]);
    for (const name of ["Pelis para el finde", "Ranking de terror", es.lists.newList]) {
      expect(stops.some((s) => s.name === name), `${name}: ${JSON.stringify(stops)}`).toBe(true);
    }
  });

  for (const width of [320, 375]) {
    test(`${width} px: sin scroll horizontal, dos columnas, axe limpio y «Nueva lista» de 44 px o más`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await openIndex(page);
      await expectNoHorizontalScroll(page, width);
      const boxes = await page.locator(`${INDEX} [data-sala-card="list"]`).evaluateAll((els) =>
        els.map((el) => el.getBoundingClientRect().top)
      );
      expect(boxes[0], "dos tarjetas en la misma fila").toBe(boxes[1]);
      const nueva = await page.getByRole("button", { name: es.lists.newList }).boundingBox();
      expect(nueva!.height).toBeGreaterThanOrEqual(44);
      await expectNoBlockingViolations(page, `Listas con «Sala» a ${width} px`);
    });
  }
});
