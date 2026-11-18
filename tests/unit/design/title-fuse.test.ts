/**
 * @vitest-environment node
 *
 * Tests unitarios — tope del fundido del título con la imagen (biblia, §3 y §9).
 *
 * - La imagen tapa como mucho el 22 % de la letra, en el título entero y en
 *   cada línea.
 * - Toda la letra visible guarda al menos 3:1 contra lo que tiene detrás.
 * - Una letra que quedaría tapada más del 35 % pasa entera por delante.
 * Cada regla se prueba justo en su límite: el límite cumple, un paso más no.
 */
import { describe, it, expect } from "vitest";
import {
  TITLE_FUSE_MAX_COVERED,
  TITLE_FUSE_MIN_CONTRAST,
  TITLE_LETTER_MAX_COVERED,
  checkTitleFuse,
  letterGoesInFront,
  measureLetterCoverage,
  measureVisibleContrast,
  planTitleFuse,
  type LetterCoverage,
  type TitleRaster,
} from "@/lib/design/title-fuse";

/** Letras de 100 píxeles en una línea: `covered` son los píxeles tapados de cada una. */
const line = (covered: number[], lineIndex = 0): LetterCoverage[] =>
  covered.map((coveredPixels) => ({ line: lineIndex, letterPixels: 100, coveredPixels }));

describe("constantes de la biblia", () => {
  it("22 %, 3:1 y 35 %", () => {
    expect(TITLE_FUSE_MAX_COVERED).toBe(0.22);
    expect(TITLE_FUSE_MIN_CONTRAST).toBe(3);
    expect(TITLE_LETTER_MAX_COVERED).toBe(0.35);
  });
});

describe("letra tapada más del 35 % → entera por delante", () => {
  it("el 35 % justo va por detrás; un píxel más, por delante", () => {
    expect(letterGoesInFront(35 / 100)).toBe(false);
    expect(letterGoesInFront(36 / 100)).toBe(true);
    expect(letterGoesInFront(0.3501)).toBe(true);
    expect(letterGoesInFront(0)).toBe(false);
  });

  it("en el plan: 35 de 100 se queda detrás, 36 de 100 pasa delante", () => {
    const at = planTitleFuse(line([35, 0, 0, 0, 0]));
    expect(at.inFront).toEqual([false, false, false, false, false]);
    expect(at.coveredShare).toBe(35 / 500);
    expect(at.worstLetterShare).toBe(0.35);
    expect(at.fused).toBe(true);

    const over = planTitleFuse(line([36, 0, 0, 0, 0]));
    expect(over.inFront).toEqual([true, false, false, false, false]);
    expect(over.coveredShare).toBe(0);
    expect(over.fused).toBe(false);
  });
});

describe("tope del 22 % en el título entero", () => {
  it("el 22 % justo cumple: nada pasa por delante", () => {
    const plan = planTitleFuse(line([22, 22, 22, 22, 22]));
    expect(plan.inFront).toEqual([false, false, false, false, false]);
    expect(plan.coveredShare).toBe(0.22);
    expect(plan.lineCoveredShares).toEqual([0.22]);
    expect(checkTitleFuse({ ...plan, minVisibleContrast: 21 }).ok).toBe(true);
  });

  it("un píxel más: sale por delante la letra más tapada, y cumple", () => {
    const plan = planTitleFuse(line([22, 23, 22, 22, 22]));
    expect(plan.inFront).toEqual([false, true, false, false, false]);
    expect(plan.coveredShare).toBe(88 / 500);
    expect(plan.coveredShare).toBeLessThanOrEqual(TITLE_FUSE_MAX_COVERED);
  });

  it("saca letras hasta cumplir, de la más tapada a la menos", () => {
    const plan = planTitleFuse(line([34, 33, 32, 31, 30])); // 160 de 500 = 32 %
    expect(plan.inFront).toEqual([true, true, false, false, false]); // 93 de 500 = 18,6 %
    expect(plan.coveredShare).toBe(93 / 500);
    expect(plan.worstLetterShare).toBe(0.32);
  });
});

describe("tope del 22 % en cada línea", () => {
  it("una línea se pasa aunque el título entero cumpla: se corrige esa línea", () => {
    // Línea 0: 60 de 400 (15 %). Línea 1: 60 de 200 (30 %). Título: 120 de 600 (20 %).
    const plan = planTitleFuse([...line([30, 30, 0, 0], 0), ...line([30, 30], 1)]);
    expect(plan.inFront).toEqual([false, false, false, false, true, false]);
    expect(plan.lineCoveredShares).toEqual([0.15, 0.15]);
    expect(plan.coveredShare).toBe(90 / 600);
  });

  it("el 22 % justo en una línea cumple", () => {
    const plan = planTitleFuse([...line([0, 0, 0, 0], 0), ...line([22, 22], 1)]);
    expect(plan.inFront).toEqual([false, false, false, false, false, false]);
    expect(plan.lineCoveredShares).toEqual([0, 0.22]);
  });

  it("una línea de una sola letra tapada al 30 %: va por delante y no hay fundido", () => {
    const plan = planTitleFuse(line([30]));
    expect(plan.inFront).toEqual([true]);
    expect(plan.fused).toBe(false);
    expect(plan.coveredShare).toBe(0);
  });

  it("cualquier reparto acaba cumpliendo en el título y en cada línea", () => {
    let seed = 1;
    const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
    for (let n = 0; n < 500; n++) {
      const letters: LetterCoverage[] = Array.from({ length: 1 + Math.floor(rnd() * 24) }, () => {
        const letterPixels = 20 + Math.floor(rnd() * 400);
        return { line: Math.floor(rnd() * 3), letterPixels, coveredPixels: Math.floor(rnd() * rnd() * letterPixels) };
      });
      const plan = planTitleFuse(letters);
      expect(plan.coveredShare).toBeLessThanOrEqual(TITLE_FUSE_MAX_COVERED);
      for (const s of plan.lineCoveredShares) expect(s).toBeLessThanOrEqual(TITLE_FUSE_MAX_COVERED);
      expect(plan.worstLetterShare).toBeLessThanOrEqual(TITLE_LETTER_MAX_COVERED);
      expect(checkTitleFuse({ ...plan, minVisibleContrast: 3 }).ok).toBe(true);
    }
  });
});

describe("planTitleFuse: bordes", () => {
  it("sin letras, o sin nada tapado, no hay fundido", () => {
    expect(planTitleFuse([])).toEqual({
      inFront: [],
      coveredShare: 0,
      lineCoveredShares: [],
      worstLetterShare: 0,
      fused: false,
    });
    expect(planTitleFuse(line([0, 0, 0])).fused).toBe(false);
  });

  it("se puede pedir un tope más bajo (margen para el movimiento), nunca más alto", () => {
    const letters = line([20, 20, 20, 20, 20]); // 20 %
    expect(planTitleFuse(letters).coveredShare).toBe(0.2);
    expect(planTitleFuse(letters, 0.18).coveredShare).toBe(80 / 500);
    const over = line([30, 30, 30, 30, 30]); // 30 %
    expect(planTitleFuse(over, 0.5).coveredShare).toBeLessThanOrEqual(TITLE_FUSE_MAX_COVERED);
  });

  it("un tope que no es un número no quita el tope: vale el 22 %", () => {
    const over = line([34, 34]); // 34 %, ninguna letra pasa del 35 %
    expect(planTitleFuse(over, NaN)).toEqual(planTitleFuse(over));
    expect(planTitleFuse(over, NaN).coveredShare).toBeLessThanOrEqual(TITLE_FUSE_MAX_COVERED);
  });

  it("una letra sin píxeles (un espacio) no cuenta ni rompe", () => {
    const plan = planTitleFuse([{ line: 0, letterPixels: 0, coveredPixels: 0 }, ...line([10, 10])]);
    expect(plan.coveredShare).toBe(0.1);
    expect(plan.fused).toBe(true);
  });
});

describe("checkTitleFuse: porcentajes ya medidos", () => {
  const ok = { coveredShare: 0.22, lineCoveredShares: [0.22, 0.1], minVisibleContrast: 3, worstLetterShare: 0.35 };

  it("los límites justos cumplen", () => {
    expect(checkTitleFuse(ok)).toEqual({ ok: true, titleOk: true, linesOk: true, contrastOk: true, lettersOk: true });
  });

  it("un paso más allá de cada límite, no", () => {
    expect(checkTitleFuse({ ...ok, coveredShare: 0.2201 })).toMatchObject({ ok: false, titleOk: false });
    expect(checkTitleFuse({ ...ok, lineCoveredShares: [0.1, 0.2201] })).toMatchObject({ ok: false, linesOk: false });
    expect(checkTitleFuse({ ...ok, minVisibleContrast: 2.99 })).toMatchObject({ ok: false, contrastOk: false });
    expect(checkTitleFuse({ ...ok, worstLetterShare: 0.3501 })).toMatchObject({ ok: false, lettersOk: false });
  });

  it("una medida que no es un número no cumple", () => {
    expect(checkTitleFuse({ ...ok, coveredShare: NaN })).toMatchObject({ ok: false, titleOk: false });
    expect(checkTitleFuse({ ...ok, lineCoveredShares: [NaN] })).toMatchObject({ ok: false, linesOk: false });
    expect(checkTitleFuse({ ...ok, minVisibleContrast: NaN })).toMatchObject({ ok: false, contrastOk: false });
    expect(checkTitleFuse({ ...ok, worstLetterShare: NaN })).toMatchObject({ ok: false, lettersOk: false });
  });

  it("las medidas del prototipo (docs/spikes/3d-ficha.md §1) cumplen en reposo", () => {
    // Parásitos a 1440: 11,2 % tapado, letra peor 33,6 %, contraste 4,13.
    expect(checkTitleFuse({ coveredShare: 0.112, lineCoveredShares: [0.112], minVisibleContrast: 4.13, worstLetterShare: 0.336 }).ok).toBe(true);
    // Con el puntero en una esquina la letra peor llega al 36,2 %: el tope de letra se aplica en reposo.
    expect(checkTitleFuse({ coveredShare: 0.115, lineCoveredShares: [0.115], minVisibleContrast: 4.13, worstLetterShare: 0.362 }).lettersOk).toBe(false);
    expect(checkTitleFuse({ coveredShare: 0.115, lineCoveredShares: [0.115], minVisibleContrast: 4.13 }).ok).toBe(true);
  });
});

describe("medir sobre píxeles", () => {
  // Rejilla de 20 × 10: dos letras de 10 × 10, macizas. La figura tapa las 3
  // primeras filas de la primera (30 %) y las 4 primeras de la segunda (40 %).
  const width = 20;
  const height = 10;
  const letter = new Uint8Array(width * height).fill(255);
  const figure = new Uint8Array(width * height);
  for (let y = 0; y < 4; y++) for (let x = 0; x < width; x++) if (y < 3 || x >= 10) figure[y * width + x] = 255;
  const raster: TitleRaster = {
    width,
    height,
    letter,
    figure,
    letters: [
      { x: 0, y: 0, width: 10, height: 10, line: 0 },
      { x: 10, y: 0, width: 10, height: 10, line: 0 },
    ],
  };
  const black = () => new Uint8ClampedArray(width * height * 4).fill(0);
  const paint = (data: Uint8ClampedArray, x: number, y: number, v: number) => data.fill(v, (y * width + x) * 4, (y * width + x) * 4 + 3);
  const white = [1, 1, 1] as const;

  it("cuenta los píxeles de letra y los tapados de cada letra", () => {
    expect(measureLetterCoverage(raster)).toEqual([
      { line: 0, letterPixels: 100, coveredPixels: 30 },
      { line: 0, letterPixels: 100, coveredPixels: 40 },
    ]);
  });

  it("el umbral de las máscaras es 128", () => {
    const soft = { ...raster, letter: Uint8Array.from(letter, (_v, i) => (i % 2 ? 128 : 127)) };
    expect(measureLetterCoverage(soft).map((l) => l.letterPixels)).toEqual([50, 50]);
    const faint = { ...raster, figure: Uint8Array.from(figure, (v) => (v ? 127 : 0)) };
    expect(measureLetterCoverage(faint).map((l) => l.coveredPixels)).toEqual([0, 0]);
  });

  it("las cajas que se salen de la rejilla se recortan", () => {
    const wide = { ...raster, letters: [{ x: -5, y: -5, width: 100, height: 100, line: 0 }] };
    expect(measureLetterCoverage(wide)).toEqual([{ line: 0, letterPixels: 200, coveredPixels: 70 }]);
  });

  it("de la medida al plan: la letra al 40 % pasa por delante; la del 30 % no", () => {
    const plan = planTitleFuse(measureLetterCoverage(raster));
    expect(plan.inFront).toEqual([false, true]);
    expect(plan.coveredShare).toBe(0.15);
  });

  it("el contraste se mide solo donde la letra se ve", () => {
    const plan = planTitleFuse(measureLetterCoverage(raster));
    const behind = black();
    // Gris claro detrás de un píxel tapado de la primera letra: no se ve, no cuenta.
    paint(behind, 2, 1, 200);
    expect(measureVisibleContrast(raster, plan.inFront, behind, white)).toEqual({
      visiblePixels: 170, // 70 de la primera + 100 de la segunda, que va entera por delante
      minContrast: 21,
      failingPixels: 0,
    });
    // El mismo gris detrás de la segunda letra, que va por delante: sí cuenta.
    paint(behind, 12, 1, 200);
    const measured = measureVisibleContrast(raster, plan.inFront, behind, white);
    expect(measured.failingPixels).toBe(1);
    expect(measured.minContrast).toBeLessThan(TITLE_FUSE_MIN_CONTRAST);
    expect(checkTitleFuse({ ...plan, minVisibleContrast: measured.minContrast })).toMatchObject({ ok: false, contrastOk: false });
  });

  it("3:1 justo: un píxel por debajo falla, uno en el límite no", () => {
    const plan = planTitleFuse(measureLetterCoverage(raster));
    // Blanco sobre #949494 da 3,03:1; sobre #969696, 2,96:1.
    const pass = black();
    paint(pass, 15, 8, 0x94);
    const passed = measureVisibleContrast(raster, plan.inFront, pass, white);
    expect(passed.minContrast).toBeGreaterThanOrEqual(3);
    expect(passed.minContrast).toBeLessThan(3.05);
    expect(passed.failingPixels).toBe(0);
    const fail = black();
    paint(fail, 15, 8, 0x96);
    const failed = measureVisibleContrast(raster, plan.inFront, fail, white);
    expect(failed.minContrast).toBeLessThan(3);
    expect(failed.failingPixels).toBe(1);
  });

  it("un píxel de letra sin dato detrás (`behind` corto) no cumple", () => {
    const plan = planTitleFuse(measureLetterCoverage(raster));
    // Solo llega la primera fila; el resto de la rejilla no tiene dato.
    const short = new Uint8ClampedArray(width * 4).fill(0);
    const measured = measureVisibleContrast(raster, plan.inFront, short, white);
    expect(measured.visiblePixels).toBe(170);
    expect(measured.minContrast).toBe(1);
    expect(measured.failingPixels).toBe(160); // 170 visibles − los 10 de la primera fila (segunda letra)
    expect(checkTitleFuse({ ...plan, minVisibleContrast: measured.minContrast }).contrastOk).toBe(false);
  });

  it("si no se ve ninguna letra, no hay contraste que medir", () => {
    const hidden = { ...raster, figure: new Uint8Array(width * height).fill(255) };
    expect(measureVisibleContrast(hidden, [false, false], black(), white)).toEqual({
      visiblePixels: 0,
      minContrast: Infinity,
      failingPixels: 0,
    });
  });
});
