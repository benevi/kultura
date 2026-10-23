import { expect, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { sessionCookie } = require("./session.cjs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SUPABASE_URL } = require("./env.cjs");

/** Reglas WCAG 2.2 A/AA (las mismas que la auditoría ACC). */
export const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Gravedades que rompen el job (ACC-18): `serious` y `critical`. */
const BLOCKING = new Set(["serious", "critical"]);

/** PNG de 1×1 para cualquier imagen externa (portadas, avatares). */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

/**
 * Corta toda petición del navegador que no sea a localhost: las imágenes
 * reciben un píxel y el resto se aborta. El job no depende de TMDB, RAWG ni
 * de ningún CDN.
 */
export async function isolateNetwork(context: BrowserContext) {
  await context.route(/^https?:\/\/(?!localhost[:/]|127\.0\.0\.1[:/])/, (route) => {
    if (route.request().resourceType() === "image") {
      return route.fulfill({ status: 200, contentType: "image/png", body: PIXEL });
    }
    return route.abort();
  });
}

/** Inicia la "sesión" simulada (cookie que acepta `mock-supabase.cjs`). */
export async function signIn(context: BrowserContext, baseURL: string) {
  await context.addCookies([sessionCookie(SUPABASE_URL, new URL(baseURL).hostname)]);
}

/** Navega y exige una respuesta 2xx/404 esperada, con la página ya estable. */
export async function open(page: Page, path: string, expectedStatus = 200) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response?.status(), `${path} devolvió ${response?.status()}`).toBe(expectedStatus);
  await page.waitForLoadState("load");
  // Pantallas que piden datos desde el cliente (Descubrir, avisos…): axe
  // mide el estado final, no el de "cargando" (si no, el resultado dependía
  // de cuánto tardaba esa petición).
  await page.waitForLoadState("networkidle").catch(() => undefined);
  // Las fuentes cambian métricas y contraste medido: se espera a que carguen.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  return response;
}

/** axe sobre la página (o un selector) y falla con `serious`/`critical`. */
export async function expectNoBlockingViolations(page: Page, label: string, include?: string) {
  let builder = new AxeBuilder({ page }).withTags(AXE_TAGS);
  if (include) builder = builder.include(include);
  const { violations } = await builder.analyze();
  const blocking = violations.filter((v) => BLOCKING.has(v.impact ?? ""));
  const report = blocking.map(
    (v) =>
      `[${v.impact}] ${v.id}: ${v.help}\n` +
      v.nodes
        .slice(0, 5)
        .map((n) => `    ${n.target.join(" ")} — ${n.failureSummary?.split("\n").slice(1).join(" ").trim()}`)
        .join("\n")
  );
  expect(blocking, `${label}: violaciones de axe\n${report.join("\n")}`).toEqual([]);
}

/** Ancho de documento: a 320 px no puede haber scroll horizontal (1.4.10). */
export async function expectNoHorizontalScroll(page: Page, width: number) {
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth, `scrollWidth ${scrollWidth} > ${width}`).toBeLessThanOrEqual(width);
}

export interface FocusStop {
  tag: string;
  name: string;
  visible: boolean;
  indicator: boolean;
}

/**
 * Recorre la página con Tab y devuelve cada parada: si está a la vista y si
 * tiene indicador de foco (contorno o sombra; WCAG 2.4.7 / 2.4.11).
 */
export async function walkTab(page: Page, maxStops = 40): Promise<FocusStop[]> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const stops: FocusStop[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < maxStops; i++) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(async () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      // Espera a que el navegador termine de desplazar hasta el foco (con
      // `scroll-behavior: smooth` medir en el acto daba posiciones a medias):
      // tres fotogramas seguidos con la misma posición, como mucho 1,5 s.
      const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
      let last = "";
      let stable = 0;
      const until = performance.now() + 1500;
      while (stable < 3 && performance.now() < until) {
        await frame();
        const r = el.getBoundingClientRect();
        const key = `${window.scrollX},${window.scrollY},${r.top},${r.left}`;
        stable = key === last ? stable + 1 : 0;
        last = key;
      }
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const outline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
      const shadow = style.boxShadow !== "none" && style.boxShadow !== "";
      // A la vista y no tapado del todo (2.4.11): en alguno de cinco puntos
      // de su caja lo que hay encima es él mismo (o algo suyo), no la
      // cabecera fija ni la barra inferior. Varios puntos porque dos enlaces
      // en línea con relleno vertical se solapan en el borde sin taparse.
      const points: Array<[number, number]> = [
        [0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75],
      ].map(([fx, fy]) => [rect.left + rect.width * fx, rect.top + rect.height * fy]);
      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        points.some(([x, y]) => {
          if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) return false;
          const onTop = document.elementFromPoint(x, y);
          return !!onTop && (el === onTop || el.contains(onTop) || onTop.contains(el));
        });
      const path = (() => {
        const parts: string[] = [];
        let node: Element | null = el;
        while (node && parts.length < 6) {
          const index = node.parentElement ? Array.from(node.parentElement.children).indexOf(node) : 0;
          parts.unshift(`${node.tagName}:${index}`);
          node = node.parentElement;
        }
        return parts.join(">");
      })();
      return {
        key: path,
        tag: el.tagName.toLowerCase(),
        name: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 60),
        visible,
        indicator: outline || shadow,
      };
    });
    if (!stop) continue;
    if (seen.has(stop.key)) break; // dio la vuelta
    seen.add(stop.key);
    stops.push({ tag: stop.tag, name: stop.name, visible: stop.visible, indicator: stop.indicator });
  }
  return stops;
}
