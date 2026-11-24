/**
 * Biblioteca con «Sala» (fase 8.5 B1): la rejilla de `SalaWorkCard` y la
 * edición rápida en `SalaDialog`. La red arranca con `SALA_BIBLIOTECA=prueba`
 * (`env.cjs`) y este spec entra con la cookie de prueba; con
 * `SALA_BIBLIOTECA=1` también pasa (salvo el caso «sin cookie»).
 *
 * Datos (`fixtures.cjs`): Matrix (película, completada, 8/10), un manga con
 * el título en japonés (en curso, sin nota) y Elden Ring (pendiente, 7/10).
 * Ninguna trae portada: se ve el respaldo con el título.
 */
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { expectNoBlockingViolations, expectNoHorizontalScroll, isolateNetwork, open, signIn } from "./helpers";
import es from "../../../messages/es.json";

const GRID = "[data-sala-library-grid]";
const quickEdit = (title: string) => es.library.quickEdit.replace("{title}", title);

async function salaCookie(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    { name: "kultura_sala_prueba", value: "1", domain: new URL(baseURL).hostname, path: "/", httpOnly: true, sameSite: "Lax" },
  ]);
}

test.beforeEach(async ({ context, baseURL }) => {
  await isolateNetwork(context);
  await signIn(context, baseURL!);
});

test.describe("sin la cookie de prueba", () => {
  test.skip(process.env.SALA_BIBLIOTECA === "1", "con SALA_BIBLIOTECA=1 la ven todos");

  test("la biblioteca de hoy, sin «Sala» ni sus hojas", async ({ page }) => {
    await open(page, "/es/library");
    await expect(page.locator(GRID)).toHaveCount(0);
    await expect(page.getByTestId("media-type-badge").first()).toBeVisible();
    const salaSheets = await page.$$eval('link[rel="stylesheet"]', (links) =>
      links.map((l) => (l as HTMLLinkElement).href).filter((href) => /sala/i.test(href))
    );
    expect(salaSheets, "hojas de «Sala» en la biblioteca de hoy").toEqual([]);
  });
});

test.describe("con «Sala»", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await salaCookie(context, baseURL!);
  });

  async function openLibrary(page: Page) {
    await open(page, "/es/library");
    await expect(page.locator(GRID)).toBeVisible();
  }

  test("rejilla: lista con nombre, un enlace por título y axe limpio", async ({ page }) => {
    await openLibrary(page);
    const list = page.getByRole("list", { name: es.library.gridLabel });
    await expect(list.getByRole("listitem")).toHaveCount(3);
    for (const title of ["Matrix", "転生したらスライムだった件", "Elden Ring"]) {
      await expect(list.getByRole("link", { name: title, exact: true })).toBeVisible();
      await expect(list.getByRole("heading", { level: 2, name: title, exact: true })).toBeVisible();
      await expect(list.getByRole("button", { name: quickEdit(title), exact: true })).toBeVisible();
    }
    // Formato, estado y nota con palabras.
    const elden = list.getByRole("listitem").filter({ hasText: "Elden Ring" });
    await expect(elden).toContainText("Videojuego");
    await expect(elden).toContainText(es.library.status.pending);
    await expect(elden).toContainText("Tu nota: 3,5 de 5");
    await expectNoBlockingViolations(page, "biblioteca con «Sala»");
  });

  test("sin scroll horizontal a 320 px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await openLibrary(page);
    await expectNoHorizontalScroll(page, 320);
  });

  test("teclado: el enlace y después su botón; el diálogo se abre, atrapa el foco, Esc cierra y vuelve", async ({ page }) => {
    await openLibrary(page);
    const link = page.getByRole("link", { name: "Elden Ring", exact: true });
    const button = page.getByRole("button", { name: quickEdit("Elden Ring"), exact: true });
    await link.focus();
    await page.keyboard.press("Tab");
    await expect(button, "la acción va justo después del enlace").toBeFocused();

    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: es.library.updateEntry });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog.getByRole("combobox", { name: es.library.statusLabel }), "el foco entra en «Estado»").toBeFocused();
    await expect(dialog.getByRole("combobox", { name: es.library.statusLabel })).toHaveValue("pending");

    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      const inside = await dialog.evaluate((el) => el.contains(document.activeElement));
      expect(inside, `Tab ${i + 1} sale del diálogo`).toBe(true);
    }
    await expectNoBlockingViolations(page, "edición rápida abierta", "[data-sala-dialog]");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(button, "el foco vuelve al botón que lo abrió").toBeFocused();
  });

  test("guardar: el diálogo se cierra, se anuncia y la tarjeta dice el estado nuevo", async ({ page }) => {
    await page.route("**/api/library", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              data: {
                entry: {
                  id: "00000000-0000-4000-8000-0000000000ab",
                  userId: "u",
                  mediaId: "game_326243",
                  status: "completed",
                  score: 4,
                  rating10: 7,
                  watchedAt: null,
                  episodeProgress: null,
                  createdAt: "2026-01-01",
                },
                log: null,
                logFailed: false,
              },
            }),
          })
        : route.continue()
    );
    await openLibrary(page);
    const button = page.getByRole("button", { name: quickEdit("Elden Ring"), exact: true });
    await button.click();
    const dialog = page.getByRole("dialog", { name: es.library.updateEntry });
    await dialog.getByRole("combobox", { name: es.library.statusLabel }).selectOption("completed");
    await dialog.getByRole("button", { name: es.library.saveStatus, exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("status").filter({ hasText: es.library.saved })).toBeAttached();
    await expect(button, "el foco vuelve al botón").toBeFocused();
    await expect(page.getByRole("listitem").filter({ hasText: "Elden Ring" })).toContainText(es.library.status.completed);
  });

  test("502 al guardar: el aviso se ve y se anuncia dentro del diálogo, que sigue abierto", async ({ page }) => {
    await page.route("**/api/library", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: { code: "provider_unavailable" } }) })
        : route.continue()
    );
    await openLibrary(page);
    await page.getByRole("button", { name: quickEdit("Matrix"), exact: true }).click();
    const dialog = page.getByRole("dialog", { name: es.library.updateEntry });
    await dialog.getByRole("button", { name: es.library.saveStatus, exact: true }).click();
    await expect(dialog.getByRole("alert").filter({ hasText: "el catálogo no responde" })).toBeVisible();
    await expect(dialog).toBeVisible();
  });
});
