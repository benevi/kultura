/**
 * DIS-12 · escala tipográfica en las páginas públicas: ≤ 7 tamaños de texto
 * distintos (tamaño calculado, `getComputedStyle`) por página y ancho.
 *
 * Cuenta todo el texto que se ve, también el decorativo (`aria-hidden`: los
 * números del podio, las pegatinas), porque lo que mide DIS-12 es lo que se
 * ve. Fuera solo lo que no se pinta (`sr-only`, ocultos, tamaño 0) y el
 * logotipo (`data-wordmark`: es la marca, no texto de la escala). Antes la
 * portada y los rankings usaban 10-12 tamaños.
 *
 * Corre en el mismo job que axe (Supabase simulado, sin red).
 */
import { test, expect, type Page } from "@playwright/test";
import { isolateNetwork, open } from "./helpers";

const MAX_SIZES = 7;
const ROUTES = ["/es", "/es/best", "/es/best/movie/2026"];

async function fontSizes(page: Page) {
  return page.evaluate(() => {
    const sizes: Record<string, string[]> = {};
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim();
      const el = node.parentElement;
      if (!text || !el || el.closest("script, style, noscript, template, [data-wordmark]")) continue;
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0 || style.visibility === "hidden" || style.display === "none") continue;
      // `sr-only` (1×1 recortado): no se ve.
      if (box.width <= 1 && box.height <= 1) continue;
      if (el.closest(".sr-only")) continue;
      const size = `${Math.round(parseFloat(style.fontSize) * 100) / 100}px`;
      (sizes[size] ??= []).push(text.slice(0, 30));
    }
    return sizes;
  });
}

test.beforeEach(async ({ context }) => {
  await isolateNetwork(context);
});

test.describe(`escala tipográfica: ≤ ${MAX_SIZES} tamaños por página (DIS-12)`, () => {
  for (const path of ROUTES) {
    test(`${path}`, async ({ page }) => {
      await open(page, path);
      const sizes = await fontSizes(page);
      const list = Object.entries(sizes)
        .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
        .map(([size, texts]) => `${size} ×${texts.length} («${texts[0]}»)`);
      expect(Object.keys(sizes).length, `${path}: ${list.join(" · ")}`).toBeLessThanOrEqual(MAX_SIZES);
    });
  }
});
