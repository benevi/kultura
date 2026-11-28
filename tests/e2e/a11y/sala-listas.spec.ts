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
 *
 * L3, la ficha `/lists/[id]`: la propia (dos títulos), la de la que es miembro
 * (vacía, ranking) y la pública de `benevi` (ni dueño ni miembro: a `/u/…/l/…`).
 * L4: ordenar y anotar en «Sala» y los miembros de la propia (`benevi` es
 * miembro: «Quitar a @benevi» con su confirmación; no se confirma, para no
 * cambiar los datos del simulado entre pruebas). Invitar se prueba en
 * `SalaListMembers.test.tsx` (en el simulado no hay amigos que invitar).
 * L5: la lista pública `/u/benevi/l/…` («Imprescindibles», un título) con
 * sesión (barra de la app, denuncia con su botón) y sin ella (cabecera
 * pública, una sola llamada a registrarse, denuncia con su enlace).
 */
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { expectNoBlockingViolations, expectNoHorizontalScroll, isolateNetwork, open, signIn, walkTab } from "./helpers";
import es from "../../../messages/es.json";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { LIST_ID, PUBLIC_LIST_ID, MEMBER_LIST_ID } = require("./fixtures.cjs");

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

const DETAIL = "[data-sala-list-detail]";

async function openDetail(page: Page, id: string = LIST_ID) {
  await open(page, `/es/lists/${id}`);
  await expect(page.locator(DETAIL)).toBeVisible();
}

test.describe("sin la cookie de prueba: la ficha de hoy", () => {
  test.skip(process.env.SALA_LISTAS === "1", "con SALA_LISTAS=1 la ven todos");

  test("sin «Sala» ni sus hojas", async ({ page }) => {
    await open(page, `/es/lists/${LIST_ID}`);
    await expect(page.locator(DETAIL)).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pelis para el finde");
    const salaSheets = await page.$$eval('link[rel="stylesheet"]', (links) =>
      links.map((l) => (l as HTMLLinkElement).href).filter((href) => /sala/i.test(href))
    );
    expect(salaSheets, "hojas de «Sala» en la ficha de hoy").toEqual([]);
  });
});

const PUBLIC_LIST = "[data-sala-public-list]";

test.describe("sin la cookie de prueba: la lista pública de hoy", () => {
  test.skip(process.env.SALA_LISTAS === "1", "con SALA_LISTAS=1 la ven todos");

  test("sin «Sala» ni sus hojas", async ({ page }) => {
    await open(page, `/es/u/benevi/l/${PUBLIC_LIST_ID}`);
    await expect(page.locator(PUBLIC_LIST)).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Imprescindibles");
    const salaSheets = await page.$$eval('link[rel="stylesheet"]', (links) =>
      links.map((l) => (l as HTMLLinkElement).href).filter((href) => /sala/i.test(href))
    );
    expect(salaSheets, "hojas de «Sala» en la lista pública de hoy").toEqual([]);
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

  test.describe("ficha de la lista (L3)", () => {
    test("la propia: `h1`, «Títulos» sin número pegado, rejilla ordenada y axe limpio", async ({ page }) => {
      await openDetail(page);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pelis para el finde");
      for (const dato of [es.discoverFilters.typeBadge.movie.toLowerCase(), es.lists.sala.collaborative]) {
        await expect(page.locator(`${DETAIL} header`)).toContainText(dato);
      }
      await expect(page.getByRole("radiogroup", { name: es.collection.visibility })).toBeVisible();
      await expect(page.getByRole("link", { name: es.lists.addItem })).toHaveAttribute("href", "/es/discover?type=movie");
      await expect(page.getByRole("heading", { level: 2, name: es.lists.itemsTitle, exact: true })).toBeVisible();
      await expect(page.locator("[data-sala-list-count]")).toHaveText("2 títulos");
      const lista = page.getByRole("list", { name: es.lists.itemsTitle });
      await expect(lista).toHaveJSProperty("tagName", "OL");
      await expect(lista.getByRole("heading", { level: 3 })).toHaveCount(2);
      await expectNoBlockingViolations(page, "Ficha de lista con «Sala»");
    });

    test("quien no es dueño ni miembro de una pública va a su página pública", async ({ page }) => {
      await page.goto(`/es/lists/${PUBLIC_LIST_ID}`);
      await expect(page).toHaveURL(new RegExp(`/es/u/benevi/l/${PUBLIC_LIST_ID}$`));
    });

    test("de la que es miembro: «de @…», vacía y sin visibilidad ni eliminar", async ({ page }) => {
      await openDetail(page, MEMBER_LIST_ID);
      await expect(page.getByRole("link", { name: "de @lucia_lee" })).toBeVisible();
      await expect(page.getByRole("heading", { level: 3, name: es.lists.noItems })).toBeVisible();
      await expect(page.getByRole("radiogroup")).toHaveCount(0);
      await expect(page.getByRole("button", { name: es.lists.deleteList })).toHaveCount(0);
      await expectNoBlockingViolations(page, "Ficha de lista ajena con «Sala»");
    });

    test("quitar un título: desaparece, «Deshacer» con el foco lo devuelve", async ({ page }) => {
      await openDetail(page);
      const lista = page.getByRole("list", { name: es.lists.itemsTitle });
      const primero = (await lista.getByRole("heading", { level: 3 }).first().textContent())!.trim();
      await page.getByRole("button", { name: es.lists.removeItemNamed.replace("{title}", primero) }).click();
      await expect(lista.getByRole("heading", { level: 3 })).toHaveCount(1);
      await expect(page.locator("[data-sala-list-count]")).toHaveText("1 título");
      const deshacer = page.getByRole("button", { name: es.lists.sala.undo });
      await expect(deshacer).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(lista.getByRole("heading", { level: 3 })).toHaveCount(2);
      await expect(page.getByRole("link", { name: new RegExp(primero) })).toBeFocused();
    });

    test("«Eliminar lista»: diálogo con su verbo, axe limpio y Escape devuelve el foco", async ({ page }) => {
      await openDetail(page);
      const abrir = page.getByRole("button", { name: es.lists.deleteList });
      await abrir.click();
      const dialogo = page.getByRole("alertdialog");
      await expect(dialogo).toBeVisible();
      await expect(dialogo.getByRole("button", { name: es.lists.deleteList })).toBeVisible();
      await expectNoBlockingViolations(page, "Eliminar lista con «Sala»");
      await page.keyboard.press("Escape");
      await expect(dialogo).toHaveCount(0);
      await expect(abrir).toBeFocused();
    });

    test("teclado: cada parada a la vista y con foco visible", async ({ page }) => {
      await openDetail(page);
      const stops = await walkTab(page, 40);
      const titles = new Set(await page.locator(`${DETAIL} [data-sala-card] a`).allTextContents());
      const bad = stops.filter((s) => !s.visible || (!s.indicator && !(s.tag === "a" && titles.has(s.name))));
      expect(bad, "paradas tapadas o sin foco visible").toEqual([]);
      for (const name of [es.lists.addItem, es.lists.deleteList, es.lists.reorder]) {
        expect(stops.some((s) => s.name === name), `${name}: ${JSON.stringify(stops)}`).toBe(true);
      }
    });

    for (const width of [320, 375]) {
      test(`${width} px: ficha sin scroll horizontal, dos columnas y axe limpio`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await openDetail(page);
        await expectNoHorizontalScroll(page, width);
        const tops = await page
          .getByRole("list", { name: es.lists.itemsTitle })
          .locator(":scope > li")
          .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
        expect(tops[0], "dos títulos en la misma fila").toBe(tops[1]);
        await expectNoBlockingViolations(page, `Ficha de lista con «Sala» a ${width} px`);
      });
    }

    test("«Quitar» va debajo de la tarjeta, sin tapar el póster (375 px)", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      await openDetail(page);
      const item = page.locator("[data-sala-list-item]").first();
      const poster = await item.locator("[data-sala-card] > div").first().boundingBox();
      const quitar = await item.getByRole("button", { name: /^Quitar «/ }).boundingBox();
      expect(quitar!.y, "«Quitar» debajo del póster").toBeGreaterThanOrEqual(poster!.y + poster!.height);
      expect(quitar!.height).toBeGreaterThanOrEqual(44);
    });
  });

  test.describe("ordenar, anotar y miembros (L4)", () => {
    test("ordenar en «Sala»: axe limpio; el asa coge, mueve y Escape lo devuelve con el foco", async ({ page }) => {
      await openDetail(page);
      await page.getByRole("button", { name: es.lists.reorder }).click();
      const orden = page.locator("[data-sala-reorder]");
      await expect(orden).toBeVisible();
      await expectNoBlockingViolations(page, "Ordenar con «Sala»");
      const filas = orden.locator("[data-sala-reorder-item]");
      const antes = await filas.evaluateAll((els) => els.map((el) => el.getAttribute("data-sala-reorder-item")));
      const asa = filas.first().getByRole("button", { name: /^Mover «/ });
      await asa.focus();
      await page.keyboard.press("Space");
      await expect(asa).toHaveAttribute("aria-pressed", "true");
      await page.keyboard.press("ArrowDown");
      await expect.poll(() => filas.evaluateAll((els) => els[1].getAttribute("data-sala-reorder-item"))).toBe(antes[0]);
      await page.keyboard.press("Escape");
      await expect.poll(() => filas.evaluateAll((els) => els.map((el) => el.getAttribute("data-sala-reorder-item")))).toEqual(antes);
      await expect(filas.first().getByRole("button", { name: /^Mover «/ })).toBeFocused();
    });

    test("anotar: el editor con su etiqueta y Escape devuelve el foco", async ({ page }) => {
      await openDetail(page);
      await page.getByRole("button", { name: es.lists.reorder }).click();
      const anotar = page.getByRole("button", { name: /^Añadir nota a «/ }).first();
      await anotar.click();
      const campo = page.getByRole("textbox", { name: /^Nota sobre «/ });
      await expect(campo).toBeFocused();
      await expectNoBlockingViolations(page, "Anotar con «Sala»");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: /^Añadir nota a «/ }).first()).toBeFocused();
    });

    test("miembros: «Quitar a @benevi» abre la confirmación con su nombre; Cancelar devuelve el foco", async ({ page }) => {
      await openDetail(page);
      const seccion = page.locator("[data-sala-list-members]");
      await expect(seccion.getByRole("heading", { level: 2, name: es.lists.membersTitle })).toBeVisible();
      await expect(seccion.getByRole("link", { name: "@benevi" })).toBeVisible();
      const quitar = seccion.getByRole("button", { name: "Quitar a @benevi" });
      await quitar.click();
      const dialogo = page.getByRole("alertdialog");
      await expect(dialogo).toContainText("¿Quitar a @benevi de la lista?");
      await expect(dialogo.getByRole("button", { name: "Quitar a @benevi" })).toBeVisible();
      await expectNoBlockingViolations(page, "Quitar miembro con «Sala»");
      await dialogo.getByRole("button", { name: es.common.cancel }).click();
      await expect(dialogo).toHaveCount(0);
      await expect(quitar).toBeFocused();
    });

    for (const width of [320, 375]) {
      test(`${width} px: ordenar y miembros sin scroll horizontal y axe limpio`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await openDetail(page);
        await page.getByRole("button", { name: es.lists.reorder }).click();
        await expectNoHorizontalScroll(page, width);
        await expectNoBlockingViolations(page, `Ordenar con «Sala» a ${width} px`);
      });
    }
  });
  test.describe("lista pública (L5)", () => {
    const path = `/es/u/benevi/l/${PUBLIC_LIST_ID}`;

    test("con sesión: barra de la app, cabecera en lectura, denuncia con su botón y axe limpio", async ({ page }) => {
      await open(page, path);
      await expect(page.locator(PUBLIC_LIST)).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Imprescindibles");
      const header = page.locator(`${PUBLIC_LIST} header`);
      // Los datos con palabras y en minúscula; el dueño, con su propio enlace.
      await expect(header).toContainText(es.discoverFilters.typeBadge.movie.toLowerCase());
      await expect(header).toContainText("1 título");
      await expect(header.getByRole("link", { name: "de @benevi" })).toHaveAttribute("href", "/es/u/benevi");
      await expect(page.getByRole("link", { name: es.collection.backToCollection })).toHaveCount(0);
      await expect(header.getByRole("button", { name: es.report.triggerList })).toBeVisible();
      // La barra de la app y ninguna llamada a registrarse.
      await expect(page.getByRole("navigation").first()).toBeVisible();
      await expect(page.getByRole("link", { name: es.collection.ctaButton })).toHaveCount(0);
      const lista = page.getByRole("list", { name: es.lists.itemsTitle });
      await expect(lista).toHaveJSProperty("tagName", "OL");
      await expect(lista.getByRole("heading", { level: 3 })).toHaveCount(1);
      await expectNoBlockingViolations(page, "Lista pública con «Sala» y sesión");
    });

    test("sin sesión: cabecera pública, una sola llamada a registrarse y la denuncia con su enlace", async ({ page, context, baseURL }) => {
      await context.clearCookies();
      await salaCookie(context, baseURL!);
      await open(page, path);
      await expect(page.locator(PUBLIC_LIST)).toBeVisible();
      const cta = page.getByRole("link", { name: es.collection.ctaButton });
      await expect(cta).toHaveCount(1);
      await expect(cta).toHaveAttribute("href", "/es/login?mode=register&ref=benevi");
      await expect(page.getByRole("link", { name: es.collection.reportList })).toHaveAttribute(
        "href",
        `/es/report?target=list&id=${PUBLIC_LIST_ID}`
      );
      await expectNoBlockingViolations(page, "Lista pública con «Sala» sin sesión");
    });

    test("teclado: cada parada a la vista y con foco visible", async ({ page, context, baseURL }) => {
      await context.clearCookies();
      await salaCookie(context, baseURL!);
      await open(page, path);
      const stops = await walkTab(page, 40);
      const titles = new Set(await page.locator(`${PUBLIC_LIST} [data-sala-card] a`).allTextContents());
      const bad = stops.filter((s) => !s.visible || (!s.indicator && !(s.tag === "a" && titles.has(s.name))));
      expect(bad, "paradas tapadas o sin foco visible").toEqual([]);
      for (const name of ["de @benevi", es.collection.reportList, es.collection.ctaButton]) {
        expect(stops.some((s) => s.name === name), `${name}: ${JSON.stringify(stops)}`).toBe(true);
      }
    });

    for (const width of [320, 375]) {
      test(`${width} px: sin scroll horizontal y axe limpio`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await open(page, path);
        await expect(page.locator(PUBLIC_LIST)).toBeVisible();
        await expectNoHorizontalScroll(page, width);
        await expectNoBlockingViolations(page, `Lista pública con «Sala» a ${width} px`);
      });
    }
  });
});
