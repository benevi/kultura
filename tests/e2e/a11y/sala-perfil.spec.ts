/**
 * Perfil con «Sala» (fase 8.5 P1): la cabecera de persona (franja, avatar y
 * `h1` con el @nombre como rótulo), los números en una fila, «Viendo ahora» y
 * «Últimos completados» con `SalaRow`/`SalaWorkCard`, y los estados de
 * biblioteca vacía. Sin «Pendientes» y sin editar la bio en sitio: el dueño
 * tiene «Editar perfil», que lleva a Ajustes. La red arranca con
 * `SALA_PERFIL=prueba` (`env.cjs`) y este spec entra con la cookie de prueba;
 * con `SALA_PERFIL=1` también pasa (salvo el caso «sin cookie»).
 *
 * Datos (`fixtures.cjs`): `a11y_tester` (quien mira) tiene un manga en curso,
 * Elden Ring pendiente y Matrix completada; `lucia_lee` es su amiga y tiene
 * Matrix completada; `benevi` no tiene nada en su biblioteca.
 */
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { expectNoBlockingViolations, expectNoHorizontalScroll, isolateNetwork, open, signIn, walkTab } from "./helpers";
import es from "../../../messages/es.json";

const PROFILE = "[data-sala-profile]";

async function salaCookie(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    { name: "kultura_sala_prueba", value: "1", domain: new URL(baseURL).hostname, path: "/", httpOnly: true, sameSite: "Lax" },
  ]);
}

async function openProfile(page: Page, username: string) {
  await open(page, `/es/profile/${username}`);
  await expect(page.locator(PROFILE)).toBeVisible();
}

test.beforeEach(async ({ context, baseURL }) => {
  await isolateNetwork(context);
  await signIn(context, baseURL!);
});

test.describe("sin la cookie de prueba", () => {
  test.skip(process.env.SALA_PERFIL === "1", "con SALA_PERFIL=1 la ven todos");

  test("el perfil de hoy, sin «Sala» ni sus hojas", async ({ page }) => {
    await open(page, "/es/profile/a11y_tester");
    await expect(page.locator(PROFILE)).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: es.profile.pendingRow })).toBeVisible();
    const salaSheets = await page.$$eval('link[rel="stylesheet"]', (links) =>
      links.map((l) => (l as HTMLLinkElement).href).filter((href) => /sala/i.test(href))
    );
    expect(salaSheets, "hojas de «Sala» en el perfil de hoy").toEqual([]);
  });
});

test.describe("con «Sala»", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await salaCookie(context, baseURL!);
  });

  test("perfil propio: h1 con el @nombre, números, filas con nombre, sin «Pendientes» ni bio en sitio; axe limpio", async ({ page }) => {
    await openProfile(page, "a11y_tester");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("@a11y_tester");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

    // «Editar perfil» lleva a Ajustes; la bio ya no se edita aquí.
    await expect(page.getByRole("link", { name: es.profile.editProfile })).toHaveAttribute("href", "/es/settings");
    await expect(page.getByRole("button", { name: new RegExp(es.profile.editBio) })).toHaveCount(0);

    const numbers = page.getByRole("region", { name: es.collection.statsLabel });
    await expect(numbers.getByRole("listitem").first()).toContainText("3");

    const watching = page.getByRole("list", { name: es.profile.watchingNow, exact: true });
    await expect(watching.getByRole("listitem")).toHaveCount(1);
    const done = page.getByRole("list", { name: es.profile.lastCompleted, exact: true });
    await expect(done.getByRole("link", { name: "Matrix", exact: true })).toBeVisible();
    await expect(done.getByRole("heading", { level: 3, name: "Matrix", exact: true })).toBeVisible();

    await expect(page.getByRole("heading", { name: es.profile.pendingRow })).toHaveCount(0);
    await expect(page.getByText("Elden Ring")).toHaveCount(0);
    // Los números sustituyen a «Estadísticas».
    await expect(page.getByRole("heading", { name: es.profile.stats })).toHaveCount(0);

    await expectNoBlockingViolations(page, "Perfil propio con «Sala»");
  });

  test("amiga: sus acciones y su actividad, sin «Editar perfil»; axe limpio", async ({ page }) => {
    await openProfile(page, "lucia_lee");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("@lucia_lee");
    await expect(page.getByRole("link", { name: es.profile.editProfile })).toHaveCount(0);
    await expect(page.getByRole("list", { name: es.profile.lastCompleted, exact: true }).getByRole("listitem")).toHaveCount(1);
    await expectNoBlockingViolations(page, "Perfil de una amiga con «Sala»");
  });

  test("otra persona con la biblioteca vacía: el estado de «Sala», sin «Sin actividad aún» repetido", async ({ page }) => {
    await openProfile(page, "benevi");
    const title = es.profile.emptyOther.replace("{username}", "benevi");
    await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
    await expect(page.getByText(es.profile.noStats)).toHaveCount(0);
    await expect(page.getByRole("region", { name: es.collection.statsLabel })).toHaveCount(0);
    await expectNoBlockingViolations(page, "Perfil vacío con «Sala»");
  });

  test("teclado: cada parada a la vista y con foco visible; las obras, alcanzables", async ({ page }) => {
    await openProfile(page, "a11y_tester");
    const stops = await walkTab(page, 60);
    const titles = new Set(await page.locator(`${PROFILE} [data-sala-card] a`).allTextContents());
    const bad = stops.filter((s) => !s.visible || (!s.indicator && !(s.tag === "a" && titles.has(s.name))));
    expect(bad, "paradas tapadas o sin foco visible").toEqual([]);
    // `walkTab` corta al ver una ruta repetida (6 niveles): la primera tarjeta
    // de la segunda fila tiene la misma que la de la primera. Basta con llegar
    // a una obra; las demás tarjetas son el mismo enlace, sin `tabindex`.
    expect(stops.some((s) => s.tag === "a" && titles.has(s.name)), JSON.stringify(stops)).toBe(true);
    expect(stops.some((s) => s.name === es.profile.editProfile), JSON.stringify(stops)).toBe(true);
    const matrix = page.getByRole("list", { name: es.profile.lastCompleted, exact: true }).getByRole("link", { name: "Matrix", exact: true });
    await expect(matrix).not.toHaveAttribute("tabindex", "-1");
  });

  for (const width of [320, 375]) {
    test(`${width} px: sin scroll horizontal, axe limpio y «Editar perfil» de 44 px o más`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await openProfile(page, "a11y_tester");
      await expectNoHorizontalScroll(page, width);
      const edit = await page.getByRole("link", { name: es.profile.editProfile }).boundingBox();
      expect(edit!.height).toBeGreaterThanOrEqual(44);
      await expectNoBlockingViolations(page, `Perfil con «Sala» a ${width} px`);
    });
  }
});
