/**
 * Perfil con «Sala» (fase 8.5 P1, P2 y P3): la cabecera de persona (franja, avatar
 * y `h1` con el @nombre como rótulo), los números en una fila, «Viendo ahora»
 * y «Últimos completados» con `SalaRow`/`SalaWorkCard`, y los estados de
 * biblioteca vacía. Sin «Pendientes» y sin editar la bio en sitio: el dueño
 * tiene «Editar perfil», que lleva a Ajustes. P2: las acciones sobre otra
 * persona en cada estado de amistad, «Dejar de ser amigos» y «Bloquear» con
 * `SalaConfirmDialog` (Cancelar primero), los errores con `SalaNotice`, la
 * denuncia de «Sala» y la actividad de la amiga con la vista de Inicio. La red
 * arranca con `SALA_PERFIL=prueba` (`env.cjs`) y este spec entra con la cookie
 * de prueba; con `SALA_PERFIL=1` también pasa (salvo el caso «sin cookie»).
 *
 * Datos (`fixtures.cjs`): `a11y_tester` (quien mira) tiene un manga en curso,
 * Elden Ring pendiente y Matrix completada; `lucia_lee` es su amiga y tiene
 * Matrix completada; `benevi` no tiene nada en su biblioteca ni relación con
 * él; a `nora_pide` le ha pedido amistad y `pau_pide` se la ha pedido a él.
 * Las escrituras del Supabase simulado no guardan nada: al recargar, todo
 * vuelve a como estaba.
 */
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { expectNoBlockingViolations, expectNoHorizontalScroll, isolateNetwork, open, signIn, walkTab } from "./helpers";
import es from "../../../messages/es.json";

const PROFILE = "[data-sala-profile]";
/** La línea que dice el estado de la amistad (la región `status` repite el texto, pero no se ve). */
const STATE = '[data-sala-profile-social] > p[tabindex="-1"]';

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

  test("/u de hoy, con y sin sesión, sin «Sala» ni sus hojas (P3)", async ({ page, context }) => {
    for (const signedIn of [true, false]) {
      if (!signedIn) await context.clearCookies();
      await open(page, "/es/u/benevi");
      await expect(page.locator("[data-sala-profile]")).toHaveCount(0);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("@benevi");
      const salaSheets = await page.$$eval('link[rel="stylesheet"]', (links) =>
        links.map((l) => (l as HTMLLinkElement).href).filter((href) => /sala/i.test(href))
      );
      expect(salaSheets, `hojas de «Sala» en /u de hoy (${signedIn ? "con" : "sin"} sesión)`).toEqual([]);
    }
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

    // P2: el estado en texto; nada de «Amigos ✓» que borra de un toque.
    await expect(page.locator(STATE)).toHaveText(es.friends.youAreFriends);
    await expect(page.getByRole("button", { name: es.friends.unfriend })).toBeVisible();
    await expect(page.getByRole("button", { name: /✓/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: es.moderation.block, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: es.report.label, exact: true })).toBeVisible();

    // Su actividad, con la vista de Inicio en «Sala».
    const activity = page.locator("[data-sala-home-activity]");
    await expect(activity.getByRole("heading", { level: 2, name: es.home.recentActivity })).toBeVisible();
    await expect(activity.getByRole("listitem")).toHaveCount(1);
    await expect(activity.getByRole("link", { name: "Matrix" })).toBeVisible();

    await expectNoBlockingViolations(page, "Perfil de una amiga con «Sala»");
  });

  test("«Dejar de ser amigos» pregunta antes: Cancelar primero y con el foco; Escape vuelve al botón; confirmar la quita", async ({ page }) => {
    await openProfile(page, "lucia_lee");
    const trigger = page.getByRole("button", { name: es.friends.unfriend });
    await trigger.click();
    const dialog = page.getByRole("alertdialog", { name: es.friends.unfriendConfirmTitle.replace("{username}", "lucia_lee") });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button").first()).toHaveText(es.common.cancel);
    await expect(dialog.getByRole("button", { name: es.common.cancel })).toBeFocused();
    await expectNoBlockingViolations(page, "Confirmar «Dejar de ser amigos»");

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    await dialog.getByRole("button", { name: es.friends.unfriend }).click();
    const add = page.getByRole("button", { name: es.friends.addFriend });
    await expect(add).toBeVisible();
    await expect(add).toBeFocused();
    await expect(page.getByRole("status").filter({ hasText: es.friends.unfriended })).toHaveCount(1);
  });

  test("«Bloquear» pregunta antes y deja «Desbloquear»; axe limpio con el diálogo abierto", async ({ page }) => {
    await openProfile(page, "lucia_lee");
    await page.getByRole("button", { name: es.moderation.block, exact: true }).click();
    const dialog = page.getByRole("alertdialog", { name: es.moderation.blockConfirmTitle });
    await expect(dialog.getByRole("button", { name: es.moderation.cancel })).toBeFocused();
    await expectNoBlockingViolations(page, "Confirmar «Bloquear»");
    await dialog.getByRole("button", { name: es.moderation.block, exact: true }).click();
    const unblock = page.getByRole("button", { name: es.moderation.unblock });
    await expect(unblock).toBeFocused();
    await expect(page.locator(STATE)).toHaveText(es.moderation.blockedNotice);
    await expect(page.getByRole("button", { name: es.friends.unfriend })).toHaveCount(0);
  });

  test("sin relación: «Añadir amigo»; si falla, el aviso con «Reintentar»; al reintentar, «Solicitud enviada» en texto", async ({ page }) => {
    let fail = true;
    await page.route("**/api/friends", async (route) => {
      if (route.request().method() === "POST" && fail) {
        fail = false;
        return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "internal" } }) });
      }
      return route.fallback();
    });
    await openProfile(page, "benevi");
    await page.getByRole("button", { name: es.friends.addFriend }).click();
    const notice = page.locator('[data-sala-notice="error"]');
    await expect(notice).toContainText(es.friends.sendError);
    await expect(page.getByRole("alert").filter({ hasText: es.friends.sendError })).toHaveCount(1);
    await expectNoBlockingViolations(page, "Error al pedir amistad");

    await notice.getByRole("button", { name: es.errors.tryAgain }).click();
    const sent = page.locator(STATE);
    await expect(sent).toHaveText(es.friends.requestSent);
    await expect(sent).toBeFocused();
    await expect(notice).toHaveCount(0);
    // «Solicitud enviada» ya no es un botón deshabilitado.
    await expect(page.getByRole("button", { name: es.friends.requestSent })).toHaveCount(0);
  });

  test("solicitud enviada: el estado y «Cancelar solicitud»; recibida: «Aceptar» y «Rechazar»", async ({ page }) => {
    await openProfile(page, "nora_pide");
    await expect(page.locator(STATE)).toHaveText(es.friends.requestSent);
    await expect(page.getByRole("button", { name: es.friends.cancelRequest })).toBeVisible();
    await expectNoBlockingViolations(page, "Solicitud enviada con «Sala»");

    await openProfile(page, "pau_pide");
    await expect(page.locator(STATE)).toHaveText(es.friends.requestReceived);
    await expect(page.getByRole("button", { name: es.friends.decline })).toBeVisible();
    await page.getByRole("button", { name: es.friends.accept }).click();
    await expect(page.locator(STATE)).toHaveText(es.friends.youAreFriends);
    await expect(page.getByRole("status").filter({ hasText: es.friends.nowFriends })).toHaveCount(1);
    await expect(page.getByRole("button", { name: es.friends.unfriend })).toBeFocused();
    await expectNoBlockingViolations(page, "Solicitud aceptada con «Sala»");
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

  test("teclado en el perfil de otra persona: las acciones, a la vista y con foco visible", async ({ page }) => {
    await openProfile(page, "pau_pide");
    await expect(page.getByRole("button", { name: es.moderation.block, exact: true })).toBeVisible();
    const stops = await walkTab(page, 40);
    const bad = stops.filter((s) => !s.visible || !s.indicator);
    expect(bad, "paradas tapadas o sin foco visible").toEqual([]);
    for (const name of [es.friends.accept, es.friends.decline, es.moderation.block, es.report.label]) {
      expect(stops.some((s) => s.name === name), `${name}: ${JSON.stringify(stops)}`).toBe(true);
    }
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

    test(`${width} px, otra persona: sin scroll horizontal y cada acción de 44 px o más`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await openProfile(page, "pau_pide");
      await expect(page.getByRole("button", { name: es.moderation.block, exact: true })).toBeVisible();
      await expectNoHorizontalScroll(page, width);
      for (const name of [es.friends.accept, es.friends.decline, es.moderation.block, es.report.label]) {
        const box = await page.getByRole("button", { name, exact: true }).boundingBox();
        expect(box!.height, name).toBeGreaterThanOrEqual(44);
      }
      await expectNoBlockingViolations(page, `Perfil de otra persona con «Sala» a ${width} px`);
    });
  }
});

/**
 * Fase 8.5 P3: el perfil público `/u/[username]` con «Sala». Sin sesión solo
 * se ve lo que se veía (cabecera sin fecha de alta, listas públicas, bloqueo
 * de la biblioteca) y una sola llamada a registrarse; con sesión, la barra de
 * la app y la biblioteca si su dueño deja verla.
 */
test.describe("/u con «Sala» (P3)", () => {
  const PUBLIC = '[data-sala-profile="public"]';

  async function openPublic(page: Page, path: string) {
    await open(page, path);
    await expect(page.locator(PUBLIC)).toBeVisible();
  }

  test.describe("sin sesión", () => {
    test.beforeEach(async ({ context, baseURL }) => {
      await context.clearCookies();
      await salaCookie(context, baseURL!);
    });

    test("anónimo: @nombre como rótulo, sin fecha de alta ni biblioteca; el bloqueo con «Ya tengo cuenta» y una sola llamada a registrarse; axe limpio", async ({ page }) => {
      await openPublic(page, "/es/u/benevi");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("@benevi");
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      // Privacidad (propuesta §7): nada que hoy no vea quien no tiene cuenta.
      await expect(page.getByText(/En KULTURA desde/)).toHaveCount(0);
      await expect(page.getByRole("region", { name: es.collection.statsLabel })).toHaveCount(0);
      await expect(page.getByRole("region", { name: es.collection.favorites })).toHaveCount(0);

      const locked = page.locator('[data-sala-profile-state="locked"]');
      await expect(locked.getByRole("heading", { level: 2 })).toHaveText(es.collection.lockedTitle.replace("{username}", "benevi"));
      await expect(locked.getByRole("link", { name: es.collection.signIn })).toHaveAttribute("href", /\/es\/login\?mode=login/);
      await expect(locked.getByRole("link", { name: es.collection.ctaButton })).toHaveCount(0);

      await expect(page.getByRole("region", { name: es.collection.ctaTitle })).toBeVisible();
      await expect(page.locator('main a[href*="mode=register"]')).toHaveCount(1);
      await expect(page.getByRole("link", { name: es.collection.reportProfile })).toHaveAttribute("href", /\/es\/report\?target=user&id=benevi/);
      await expectNoBlockingViolations(page, "/u anónimo con «Sala»");
    });

    test("anónimo con invitación: la invitación va antes del h1 y es la única llamada a registrarse; axe limpio", async ({ page }) => {
      await openPublic(page, "/es/u/benevi?ref=benevi&inv=firma-que-no-vale");
      const invite = page.getByRole("complementary", { name: es.invite.bannerTitle.replace("{username}", "benevi") });
      await expect(invite).toBeVisible();
      // La firma no vale: no promete amistad.
      await expect(invite).toContainText(es.invite.bannerText);
      await expect(invite.getByRole("link", { name: es.invite.bannerCta })).toHaveAttribute("href", /mode=register.*ref=benevi/);
      await expect(page.getByRole("region", { name: es.collection.ctaTitle })).toHaveCount(0);
      await expect(page.locator('main a[href*="mode=register"]')).toHaveCount(1);
      const order = await page.evaluate(() => {
        const aside = document.querySelector("[data-sala-profile-invite]")!;
        const h1 = document.querySelector("h1")!;
        return aside.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING;
      });
      expect(order, "la invitación, antes del h1").toBeTruthy();
      await expectNoBlockingViolations(page, "/u con invitación y «Sala»");
    });

    test("anónimo: una lista pública con su fila y «Ver lista»", async ({ page }) => {
      await openPublic(page, "/es/u/benevi");
      const lists = page.locator("[data-sala-profile-lists]");
      // Si el Supabase simulado no resuelve la consulta anidada, la página dice que no hay listas: las dos salidas valen.
      if ((await lists.count()) === 0) {
        await expect(page.locator('[data-sala-profile-state="lists-empty"]')).toBeVisible();
        return;
      }
      await expect(lists.getByRole("heading", { level: 2, name: es.collection.publicLists })).toBeVisible();
      await expect(lists.getByRole("heading", { level: 3, name: "Imprescindibles" })).toBeVisible();
      await expect(lists.getByRole("link", { name: /Ver lista Imprescindibles/ })).toHaveAttribute("href", /\/es\/u\/benevi\/l\//);
    });

    test("teclado y 320 px: cada parada a la vista y con foco visible, sin scroll horizontal", async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 800 });
      await openPublic(page, "/es/u/benevi?ref=benevi&inv=x");
      await expectNoHorizontalScroll(page, 320);
      const stops = await walkTab(page, 40);
      const bad = stops.filter((s) => !s.visible || !s.indicator);
      expect(bad, "paradas tapadas o sin foco visible").toEqual([]);
      await expectNoBlockingViolations(page, "/u anónimo a 320 px");
    });
  });

  test.describe("con sesión", () => {
    test.beforeEach(async ({ context, baseURL }) => {
      await salaCookie(context, baseURL!);
    });

    test("otra persona: la barra de la app, su fecha de alta, números y favoritos con su nota; «Ver su perfil» y denunciar; axe limpio", async ({ page }) => {
      await openPublic(page, "/es/u/lucia_lee");
      // La barra de la app, no el logo con «Inicio».
      await expect(page.getByRole("navigation", { name: es.nav.primaryNav }).first().getByRole("link", { name: es.nav.libraryTab })).toBeAttached();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("@lucia_lee");
      await expect(page.getByText(/En KULTURA desde/)).toBeVisible();
      await expect(page.getByRole("region", { name: es.collection.statsLabel })).toBeVisible();
      const favorites = page.getByRole("region", { name: es.collection.favorites });
      await expect(favorites.getByRole("heading", { level: 3, name: "Matrix" })).toBeVisible();
      await expect(favorites).toContainText(/Nota: 4 de 5|Nota: 8 de 10/);
      await expect(page.getByRole("link", { name: es.collection.openProfile })).toHaveAttribute("href", "/es/profile/lucia_lee");
      await expect(page.getByRole("button", { name: es.report.label, exact: true })).toBeVisible();
      await expect(page.locator('main a[href*="mode=register"]')).toHaveCount(0);
      await expectNoBlockingViolations(page, "/u con sesión y «Sala»");
    });

    test("propio: «Invitar amigos» y «Editar perfil» de 44 px o más, nota de visibilidad con enlace a Ajustes; axe limpio a 375", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      await openPublic(page, "/es/u/a11y_tester");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("@a11y_tester");
      for (const control of [page.getByRole("button", { name: es.invite.share }), page.getByRole("link", { name: es.profile.editProfile })]) {
        await expect(control).toBeVisible();
        expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      await expect(page.locator("[data-sala-profile-owner-note]").getByRole("link")).toHaveAttribute("href", "/es/settings");
      await expect(page.getByRole("region", { name: es.collection.favorites }).getByRole("listitem")).not.toHaveCount(0);
      await expectNoHorizontalScroll(page, 375);
      await expectNoBlockingViolations(page, "/u propio con «Sala» a 375 px");
    });
  });
});
