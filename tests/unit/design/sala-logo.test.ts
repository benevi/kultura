/**
 * @vitest-environment node
 *
 * Fase 8.5 · M1 — los SVG de `public/brand/` son exactamente lo que genera
 * `src/lib/brand/sala-logo.ts`, y la tinta del logo guarda el contraste
 * medido en la propuesta (D1 «Bloque»). Para regenerarlos:
 * `npm run brand:sala` (este test con `-u`; luego los PNG con
 * `node scripts/gen-sala-brand.mjs`).
 */
import { describe, expect, it } from "vitest";
import { resolve } from "path";
import { parseHex, contrastRatio } from "@/lib/design/color";
import { SALA_COLOR } from "@/lib/design/sala-tokens";
import { salaBrandFiles, SALA_LOGO_INK, SALA_ICON_BACKGROUND, SALA_ICON_SCALE } from "@/lib/brand/sala-logo";

/** Con dos decimales, como se midió en la propuesta. */
const ratio = (a: string, b: string) => Math.round(contrastRatio(parseHex(a)!, parseHex(b)!) * 100) / 100;

describe("logo de «Sala»", () => {
  for (const [name, svg] of Object.entries(salaBrandFiles())) {
    it(`public/brand/${name} coincide con el generador`, async () => {
      await expect(svg).toMatchFileSnapshot(resolve(__dirname, "../../../public/brand", name));
    });

    it(`${name} pesa poco y no depende de fuentes ni de imágenes`, () => {
      expect(svg.length).toBeLessThan(2048);
      expect(svg).not.toMatch(/<text|<image|font-family|href=/);
    });
  }

  it("la tinta guarda el contraste de la propuesta sobre fondo y panel", () => {
    expect(ratio(SALA_LOGO_INK.dark, SALA_COLOR.dark.background)).toBeGreaterThanOrEqual(15.88);
    expect(ratio(SALA_LOGO_INK.dark, SALA_COLOR.dark.panel)).toBeGreaterThanOrEqual(13.62);
    expect(ratio(SALA_LOGO_INK.light, SALA_COLOR.light.background)).toBeGreaterThanOrEqual(13.59);
    expect(ratio(SALA_LOGO_INK.light, SALA_COLOR.light.panel)).toBeGreaterThanOrEqual(11.64);
    expect(ratio(SALA_LOGO_INK.dark, SALA_ICON_BACKGROUND)).toBeGreaterThanOrEqual(15.88);
  });

  it("el símbolo del maskable cabe en la zona segura (círculo del 80 %)", () => {
    expect((SALA_ICON_SCALE.maskable * Math.SQRT2) / 2).toBeLessThanOrEqual(0.4);
  });
});
