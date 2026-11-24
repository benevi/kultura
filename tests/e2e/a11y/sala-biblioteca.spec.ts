/**
 * Biblioteca con «Sala» (fase 8.5 B1 y B2): la rejilla de `SalaWorkCard`, la
 * edición rápida en `SalaDialog` y, desde B2, la cabecera, los contadores que
 * filtran por estado, el panel de filtros y el orden. La red arranca con `SALA_BIBLIOTECA=prueba`
 * (`env.cjs`) y este spec entra con la cookie de prueba; con
 * `SALA_BIBLIOTECA=1` también pasa (salvo el caso «sin cookie»).
 *
 * Datos (`fixtures.cjs`): Matrix (película, completada, 8/10), un manga con
 * el título en japonés (en curso, sin nota, por el capítulo 34 del volumen 5)
 * y Elden Ring (pendiente, 7/10).
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

  test("cabecera: un h1 y el número de títulos, que se anuncia", async ({ page }) => {
    await openLibrary(page);
    await expect(page.getByRole("heading", { level: 1, name: es.library.title, exact: true })).toBeVisible();
    await expect(page.locator("[data-sala-library-count]")).toHaveAttribute("role", "status");
    await expect(page.locator("[data-sala-library-count]")).toHaveText("3 títulos");
  });

  test("progreso: el manga en curso dice capítulo y volumen", async ({ page }) => {
    await openLibrary(page);
    const manga = page.getByRole("listitem").filter({ hasText: "転生したらスライムだった件" });
    await expect(manga.locator("[data-sala-library-progress]")).toHaveText(/Cap\. 34 · Vol\. 5$/);
    await expect(page.getByRole("listitem").filter({ hasText: "Matrix" }).locator("[data-sala-library-progress]")).toHaveCount(0);
  });

  test("contadores: filtran por estado con aria-pressed, a la URL y anunciado", async ({ page }) => {
    await openLibrary(page);
    const group = page.getByRole("group", { name: es.library.sala.statusFilter });
    const pending = group.getByRole("button", { name: `1 ${es.library.counters.pending}`, exact: true });
    await expect(pending).toHaveAttribute("aria-pressed", "false");
    await pending.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/[?&]status=pending/);
    await expect(pending).toHaveAttribute("aria-pressed", "true");
    await expect(pending, "el foco sigue en el contador").toBeFocused();
    await expect(page.locator("[data-sala-library-count]")).toHaveText("1 título");
    await expect(page.getByRole("list", { name: es.library.gridLabel }).getByRole("listitem")).toHaveCount(1);
    // Otra vez: quita el filtro.
    await page.keyboard.press("Enter");
    await expect(page).not.toHaveURL(/status=/);
    await expect(page.locator("[data-sala-library-count]")).toHaveText("3 títulos");
  });

  test("filtros: el panel se abre con el teclado, filtra con aria-pressed y axe limpio", async ({ page }) => {
    await openLibrary(page);
    // Su nombre cambia con los filtros puestos («Filtros · 1»): se busca por el panel que abre.
    const toggle = page.locator("button[aria-controls]").filter({ hasText: es.filters.filters });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const type = page.getByRole("group", { name: es.filters.type, exact: true });
    await expect(type).toBeVisible();
    await expect(type.getByRole("button", { name: es.filters.all, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expectNoBlockingViolations(page, "biblioteca con los filtros abiertos");

    await type.getByRole("button", { name: es.filters.game, exact: true }).click();
    await expect(page).toHaveURL(/[?&]type=game/);
    await expect(type.getByRole("button", { name: es.filters.game, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(toggle, "el panel sigue abierto y dice cuántos filtros hay").toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toHaveText("Filtros · 1");
    await expect(page.locator("[data-sala-library-count]")).toHaveText("1 título");

    await page.getByRole("button", { name: es.filters.reset, exact: true }).first().click();
    await expect(page).not.toHaveURL(/type=/);
  });

  test("orden: el desplegable va a la URL y reordena la rejilla", async ({ page }) => {
    await openLibrary(page);
    // Un `<select>` cambiado antes de hidratar no llega a React: se espera a
    // que la página responda (el panel se abre) antes de elegir.
    const toggle = page.locator("button[aria-controls]").filter({ hasText: es.filters.filters });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const sort = page.getByRole("combobox", { name: es.library.sala.sortLabel });
    await sort.selectOption("title");
    await expect(page).toHaveURL(/[?&]sort=title/);
    const titles = page.getByRole("list", { name: es.library.gridLabel }).getByRole("heading", { level: 2 });
    await expect(titles).toHaveText(["Elden Ring", "Matrix", "転生したらスライムだった件"]);
  });

  test("320 px con los filtros abiertos: sin scroll horizontal y objetivos de 44 px o más", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await openLibrary(page);
    await page.getByRole("button", { name: es.filters.filters, exact: true }).click();
    await expect(page.getByRole("group", { name: es.filters.type, exact: true })).toBeVisible();
    await expectNoHorizontalScroll(page, 320);
    const small = await page.$$eval("[data-sala-library] button, [data-sala-library] nav a, [data-sala-library] select", (els) =>
      els
        .filter((el) => !el.closest("[data-sala-library-grid]") && (el as HTMLElement).offsetParent !== null)
        .map((el) => ({ text: el.textContent?.trim(), h: el.getBoundingClientRect().height }))
        .filter((r) => r.h < 44)
    );
    expect(small, "controles de menos de 44 px").toEqual([]);
  });

  test("movimiento reducido: el panel aparece sin animación", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openLibrary(page);
    await page.getByRole("button", { name: es.filters.filters, exact: true }).click();
    const animation = await page.locator("[data-sala-library-filters]").evaluate((el) => getComputedStyle(el).animationName);
    expect(animation).toBe("none");
  });
});
