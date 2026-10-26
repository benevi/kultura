/**
 * ACC-1 / MOV-8 · Diálogos: cada uno se abre con el teclado, el foco entra,
 * 20 Tab (y Mayús+Tab) no salen, axe no encuentra violaciones dentro, Esc
 * cierra y el foco vuelve al botón que lo abrió. En móvil, los de variante
 * hoja salen pegados abajo y sin pasar del 85 % de la pantalla.
 */
import { test, expect, type Locator, type Page } from "@playwright/test";
import { expectNoBlockingViolations, isolateNetwork, open, signIn } from "./helpers";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { LIST_ID, GROUP_ID } = require("./fixtures.cjs");

interface DialogCase {
  name: string;
  path: string;
  opener: string;
  title: string | RegExp;
  role?: "dialog" | "alertdialog";
  sheet?: boolean;
}

const DIALOGS: DialogCase[] = [
  { name: "CreateListModal", path: "/es/lists", opener: "Nueva lista", title: "Crear lista", sheet: true },
  {
    name: "ConfirmModal (borrar lista)",
    path: `/es/lists/${LIST_ID}`,
    opener: "Eliminar lista",
    title: "¿Eliminar esta lista?",
    role: "alertdialog",
  },
  {
    name: "ConfirmModal (borrar cuenta)",
    path: "/es/settings",
    opener: "Eliminar cuenta",
    title: "¿Eliminar tu cuenta?",
    role: "alertdialog",
  },
  { name: "InviteFriendsModal", path: `/es/groups/${GROUP_ID}`, opener: "Invitar", title: "Invitar amigos" },
  {
    name: "LibraryStatusModal",
    path: "/es/media/movie/550",
    opener: "Añadir a biblioteca",
    title: "Añadir a biblioteca",
    sheet: true,
  },
  {
    name: "RecommendModal",
    path: "/es/media/movie/550",
    opener: "Recomendar",
    title: "Recomendar a un amigo",
    sheet: true,
  },
  {
    name: "AddToListButton",
    path: "/es/media/movie/550",
    opener: "Añadir a lista",
    title: "Añadir a una lista",
    sheet: true,
  },
  {
    name: "ConfirmModal (quitar de la biblioteca)",
    path: "/es/media/movie/603",
    opener: "Eliminar",
    title: "¿Quitar de tu biblioteca?",
    role: "alertdialog",
  },
];

async function focusIsInside(page: Page, dialog: Locator) {
  const handle = await dialog.elementHandle();
  return page.evaluate((el) => !!el && el.contains(document.activeElement), handle);
}

test.beforeEach(async ({ context, baseURL }) => {
  await isolateNetwork(context);
  await signIn(context, baseURL!);
});

for (const c of DIALOGS) {
  test(`${c.name}: foco, trampa, Esc, devolución y axe`, async ({ page }, testInfo) => {
    await open(page, c.path);
    const opener = page.getByRole("button", { name: c.opener, exact: true });
    await opener.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole(c.role ?? "dialog", { name: c.title });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect.poll(() => focusIsInside(page, dialog), { message: "el foco entra al abrir" }).toBe(true);

    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");
      expect(await focusIsInside(page, dialog), `Tab ${i + 1} sale del diálogo`).toBe(true);
    }
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Shift+Tab");
      expect(await focusIsInside(page, dialog), `Mayús+Tab ${i + 1} sale del diálogo`).toBe(true);
    }

    await expectNoBlockingViolations(page, `${c.name} abierto`, '[data-testid="modal-panel"]');

    if (c.sheet && testInfo.project.name === "movil-390") {
      const box = await dialog.boundingBox();
      const viewport = page.viewportSize()!;
      expect(box, "la hoja tiene caja").not.toBeNull();
      expect(Math.round(box!.y + box!.height), "pegada abajo").toBeGreaterThanOrEqual(viewport.height - 1);
      expect(box!.height, "≤ 85 % del alto").toBeLessThanOrEqual(viewport.height * 0.85 + 1);
      expect(Math.round(box!.width), "a todo el ancho").toBe(viewport.width);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener, "el foco vuelve al botón que lo abrió").toBeFocused();
  });
}

/**
 * Revisión #41: un fallo con el diálogo abierto tiene que verse (encima de
 * todo, no debajo de la hoja ni del fondo) y anunciarse (fuera de cualquier
 * `aria-hidden`/`inert`). Se simula el 502 del catálogo y un 500 de listas.
 */
async function expectAnnouncedAlert(page: Page, dialog: Locator, text: string) {
  const alert = dialog.getByRole("alert").filter({ hasText: text });
  await expect(alert).toBeVisible();
  const state = await alert.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const onTop = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      onTop: !!onTop && (onTop === el || el.contains(onTop)),
      hidden: !!el.closest('[aria-hidden="true"], [inert]'),
    };
  });
  expect(state.onTop, "el aviso está encima, no tapado").toBe(true);
  expect(state.hidden, "el aviso no está en una zona aria-hidden/inert").toBe(false);
}

test("502 del catálogo al guardar: el aviso se ve y se anuncia con el diálogo abierto", async ({ page }) => {
  await page.route("**/api/library", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "Media provider unavailable" }) })
      : route.continue()
  );
  await open(page, "/es/media/movie/550");
  await page.getByRole("button", { name: "Añadir a biblioteca", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Añadir a biblioteca" });
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expectAnnouncedAlert(page, dialog, "el catálogo no responde");
  await expect(dialog).toBeVisible();
});

test("error al añadir a una lista: el aviso se ve y se anuncia con el diálogo abierto", async ({ page }) => {
  await page.route(`**/api/lists/${LIST_ID}`, (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" })
      : route.continue()
  );
  await open(page, "/es/media/movie/550");
  await page.getByRole("button", { name: "Añadir a lista", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Añadir a una lista" });
  await dialog.getByRole("radio", { name: "Pelis para el finde" }).check();
  await dialog.getByRole("button", { name: "Añadir", exact: true }).click();
  await expectAnnouncedAlert(page, dialog, "No hemos podido añadir el título");
});

test("StarRating: flechas cambian la nota y el foco se ve (ACC-8)", async ({ page }) => {
  await open(page, "/es/media/movie/550");
  await page.getByRole("button", { name: "Añadir a biblioteca", exact: true }).click();
  const group = page.getByRole("radiogroup", { name: "Puntuación" });
  await expect(group).toBeVisible();
  // Una sola parada de Tab en el grupo.
  await expect(group.locator('[tabindex="0"]')).toHaveCount(1);
  const first = group.getByRole("radio").first();
  await first.focus();
  await page.keyboard.press("ArrowRight");
  const second = group.getByRole("radio", { name: "2 estrellas" });
  await expect(second).toBeFocused();
  await expect(second).toHaveAttribute("aria-checked", "true");
  const outline = await second.evaluate((el) => {
    const s = getComputedStyle(el);
    return s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2;
  });
  expect(outline, "anillo de foco visible").toBe(true);
});

test("Hoja: arrastrar el asa hacia abajo la cierra (MOV-8)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "movil-390", "El asa solo existe en móvil.");
  await open(page, "/es/lists");
  await page.getByRole("button", { name: "Nueva lista", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Crear lista" });
  await expect(dialog).toBeVisible();
  const handle = page.getByTestId("sheet-handle");
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 200, { steps: 8 });
  await page.mouse.up();
  await expect(dialog).toBeHidden();
});
