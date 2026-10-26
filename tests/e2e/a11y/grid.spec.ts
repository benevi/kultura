/**
 * F-30 · DIS-8 y DIS criterio (5): retícula única y 0 desbordes.
 *
 * - A 1440 px (y a 390) el borde izquierdo del logo, del h1 y del contenido
 *   coincide (±4 px) en 7 rutas: antes el logo estaba en x = 176, el h1 de la
 *   portada en 56 y rankings, perfil y legales en 304-368.
 * - De 320 a 1440 px ninguna página pública ni de la app desborda en
 *   horizontal.
 *
 * Corre en el mismo job que axe (Supabase simulado, sin red).
 */
import { test, expect, type Page } from "@playwright/test";
import { isolateNetwork, open, signIn } from "./helpers";

interface GridRoute {
  path: string;
  session?: boolean;
  /** Bloque de contenido cuando el `<main>` no es la propia retícula. */
  content?: string;
}

const GRID_ROUTES: GridRoute[] = [
  { path: "/es", content: "#features-title" },
  { path: "/es/best/movie/2026" },
  { path: "/es/u/benevi" },
  { path: "/es/privacy" },
  { path: "/es/media/movie/550" },
  { path: "/es/home", session: true },
  { path: "/es/library", session: true },
];

/** Borde izquierdo (x) del logo, del h1 y del contenido. */
async function edges(page: Page, content?: string) {
  return page.evaluate((contentSel) => {
    const visible = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? r : null;
    };
    const logo = visible(document.querySelector("header svg"));
    // El encabezado de la página: el h1 visible (Inicio lo tiene solo para
    // lectores de pantalla; ahí, el primer h2).
    const heading =
      Array.from(document.querySelectorAll("main h1")).find((el) => visible(el)) ??
      Array.from(document.querySelectorAll("main h2")).find((el) => visible(el)) ??
      null;
    const grid = (heading?.closest(".page-grid") ?? document.querySelector("main.page-grid, main .page-grid")) as HTMLElement | null;
    // Su bloque: el hijo de la retícula que lo contiene (el h1 del perfil va
    // tras el avatar y el de la ficha dentro del póster; lo que se alinea es
    // la pieza entera, que empieza en el borde de la retícula).
    let block: Element | null = heading;
    while (block && block.parentElement && block.parentElement !== grid) block = block.parentElement;
    const h1 = grid && block ? visible(block) : visible(heading);
    let left: number | null = null;
    if (contentSel) left = visible(document.querySelector(contentSel))?.left ?? null;
    else if (grid) {
      // El contenido empieza donde empieza la caja de contenido de la retícula.
      const r = grid.getBoundingClientRect();
      left = r.left + parseFloat(getComputedStyle(grid).paddingLeft);
    }
    return { logo: logo?.left ?? null, h1: h1?.left ?? null, content: left };
  }, content);
}

test.beforeEach(async ({ context }) => {
  await isolateNetwork(context);
});

test.describe("retícula única (DIS-8)", () => {
  for (const route of GRID_ROUTES) {
    test(`logo, h1 y contenido alineados en ${route.path}`, async ({ page, context, baseURL }) => {
      if (route.session) await signIn(context, baseURL!);
      await open(page, route.path);
      const e = await edges(page, route.content);
      expect(e.logo, "sin logo en la cabecera").not.toBeNull();
      expect(e.h1, "sin h1 visible").not.toBeNull();
      expect(e.content, "sin bloque de contenido").not.toBeNull();
      const xs = [e.logo!, e.h1!, e.content!];
      expect(Math.max(...xs) - Math.min(...xs), `bordes ${JSON.stringify(e)}`).toBeLessThanOrEqual(4);
    });
  }
});

const WIDTHS = [320, 375, 414, 768, 1024, 1280, 1440];
const OVERFLOW_PUBLIC = ["/es", "/en", "/es/best", "/es/best/movie/2026", "/es/u/benevi", "/es/privacy", "/es/terms", "/es/login", "/es/media/movie/550"];
const OVERFLOW_APP = ["/es/home", "/es/library", "/es/lists", "/es/friends", "/es/chat", "/es/notifications", "/es/settings"];

async function expectNoOverflow(page: Page, paths: string[]) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of paths) {
      await open(page, path);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      expect.soft(sw, `${path} a ${width} px: scrollWidth ${sw}`).toBeLessThanOrEqual(width);
    }
  }
}

test.describe("0 desbordes de 320 a 1440 px", () => {
  // Recorre todos los anchos él mismo: basta con un proyecto.
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "escritorio-1440", "los anchos los fija el propio test");
  });

  test("páginas públicas", async ({ page }) => {
    test.setTimeout(240_000);
    await expectNoOverflow(page, OVERFLOW_PUBLIC);
  });

  test("app con sesión", async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    await signIn(context, baseURL!);
    await expectNoOverflow(page, OVERFLOW_APP);
  });
});
