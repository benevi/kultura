/**
 * @vitest-environment node
 *
 * Fase 8.4 — el fundido del rótulo, listo para pintar
 * (`src/lib/design/sala-title-fuse.ts`). Biblia §3 y §9: las reglas se miden.
 *
 * Lo que se prueba, como propiedad: con cualquier título y cualquier figura,
 * lo que `SalaStage` pinta nunca pasa de los topes. Se simula lo pintado
 * píxel a píxel (la figura, menos las cajas de las letras que van por
 * delante) y se vuelve a medir con `title-fuse.ts`.
 */
import { describe, expect, it } from "vitest";
import { resolveSalaFuse, salaFuseBackground, salaFuseLetterCount, type SalaFuseData, type SalaFuseLetter } from "@/lib/design/sala-title-fuse";
import {
  checkTitleFuse,
  measureLetterCoverage,
  TITLE_FUSE_MAX_COVERED,
  TITLE_FUSE_MIN_CONTRAST,
  TITLE_LETTER_MAX_COVERED,
  type LetterBox,
  type TitleRaster,
} from "@/lib/design/title-fuse";

function azar(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Una sala inventada: letras en una, dos o tres líneas y una figura de manchas al azar. */
function sala(rnd: () => number) {
  const width = 240;
  const height = 135;
  const lines = 1 + Math.floor(rnd() * 3);
  const perLine = 2 + Math.floor(rnd() * 9);
  const letterH = 22;
  const letterW = Math.floor((width - 20) / perLine) - 2;
  const letter = new Uint8Array(width * height);
  const figure = new Uint8Array(width * height);
  const letters: LetterBox[] = [];
  for (let line = 0; line < lines; line++) {
    const count = Math.max(1, perLine - Math.floor(rnd() * 3));
    for (let i = 0; i < count; i++) {
      const box = { x: 10 + i * (letterW + 2), y: height - 10 - (lines - line) * (letterH + 3), width: letterW, height: letterH, line };
      letters.push(box);
      // Una «letra»: un marco con un trazo, para que no sea un rectángulo macizo.
      for (let y = box.y; y < box.y + box.height; y++) {
        for (let x = box.x; x < box.x + box.width; x++) {
          const borde = x - box.x < 3 || box.x + box.width - x <= 3 || y - box.y < 3;
          if (borde || rnd() < 0.15) letter[y * width + x] = 255;
        }
      }
    }
  }
  // La figura: de ninguna a cuatro manchas, de cualquier tamaño, por donde va el título.
  const manchas = Math.floor(rnd() * 5);
  for (let m = 0; m < manchas; m++) {
    const cx = rnd() * width;
    const cy = height - rnd() * 100;
    const rx = 4 + rnd() * 70;
    const ry = 4 + rnd() * 60;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) figure[y * width + x] = 255;
      }
    }
  }
  const raster: TitleRaster = { width, height, letter, figure, letters };
  const data: SalaFuseData = {
    letters: measureLetterCoverage(raster).map((c, i): SalaFuseLetter => {
      const b = letters[i];
      return { ...c, box: { x: b.x / width, y: b.y / height, width: b.width / width, height: b.height / height } };
    }),
    minContrast: 1 + rnd() * 8,
  };
  return { raster, data, title: "x".repeat(letters.length) };
}

/** Lo que se pinta: la figura tapa un píxel de letra salvo dentro de la caja de una letra que va por delante. */
function pintado(raster: TitleRaster, holes: ReadonlyArray<{ x: number; y: number; width: number; height: number }>) {
  const figure = Uint8Array.from(raster.figure as Uint8Array);
  for (const h of holes) {
    const x0 = Math.floor(h.x * raster.width);
    const x1 = Math.ceil((h.x + h.width) * raster.width);
    const y0 = Math.floor(h.y * raster.height);
    const y1 = Math.ceil((h.y + h.height) * raster.height);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) figure[y * raster.width + x] = 0;
  }
  return measureLetterCoverage({ ...raster, figure });
}

describe("propiedad: lo que se pinta nunca pasa de los topes", () => {
  it("22 % en el título y en cada línea, 35 % por letra, 3:1, y las letras de delante, enteras", () => {
    const rnd = azar(20261119);
    let fundidos = 0;
    let sinFundido = 0;
    for (let caso = 0; caso < 1500; caso++) {
      const { raster, data, title } = sala(rnd);
      const resuelto = resolveSalaFuse(data, title, raster.width / raster.height);
      if (!resuelto) {
        sinFundido++;
        continue;
      }
      fundidos++;
      // Nunca con menos de 3:1.
      expect(data.minContrast).toBeGreaterThanOrEqual(TITLE_FUSE_MIN_CONTRAST);
      const real = pintado(raster, resuelto.holes);
      let total = 0;
      let tapado = 0;
      const porLinea = new Map<number, [number, number]>();
      let peorLetra = 0;
      real.forEach((letra, i) => {
        total += letra.letterPixels;
        tapado += letra.coveredPixels;
        const acumulado = porLinea.get(letra.line) ?? [0, 0];
        porLinea.set(letra.line, [acumulado[0] + letra.letterPixels, acumulado[1] + letra.coveredPixels]);
        const parte = letra.letterPixels > 0 ? letra.coveredPixels / letra.letterPixels : 0;
        peorLetra = Math.max(peorLetra, parte);
        // Una letra que va por delante se ve entera.
        if (resuelto.plan.inFront[i]) expect(letra.coveredPixels, `caso ${caso}, letra ${i}`).toBe(0);
        // Y una que va por detrás nunca queda más tapada de lo que se midió.
        else expect(letra.coveredPixels).toBeLessThanOrEqual(data.letters[i].coveredPixels);
      });
      const veredicto = checkTitleFuse({
        coveredShare: total > 0 ? tapado / total : 0,
        lineCoveredShares: [...porLinea.values()].map(([t, c]) => (t > 0 ? c / t : 0)),
        minVisibleContrast: data.minContrast,
        worstLetterShare: peorLetra,
      });
      expect(veredicto, `caso ${caso}`).toEqual({ ok: true, titleOk: true, linesOk: true, contrastOk: true, lettersOk: true });
      expect(tapado / total).toBeLessThanOrEqual(TITLE_FUSE_MAX_COVERED);
      expect(peorLetra).toBeLessThanOrEqual(TITLE_LETTER_MAX_COVERED);
    }
    // La prueba ha pasado por los dos caminos.
    expect(fundidos).toBeGreaterThan(200);
    expect(sinFundido).toBeGreaterThan(200);
  });
});

const LETRA = (line: number, letterPixels: number, coveredPixels: number, x = 0.1): SalaFuseLetter => ({
  line,
  letterPixels,
  coveredPixels,
  box: { x, y: 0.7, width: 0.08, height: 0.2 },
});

/** Cuatro letras: una tapada al 20 %, las demás limpias. Cumple. */
const BUENO: SalaFuseData = { letters: [LETRA(0, 100, 20, 0.1), LETRA(0, 100, 0, 0.2), LETRA(0, 100, 0, 0.3), LETRA(0, 100, 0, 0.4)], minContrast: 4.5 };

describe("degradar a «título por delante, entero»", () => {
  it("con datos que cumplen, hay fundido", () => {
    const r = resolveSalaFuse(BUENO, "Roma");
    expect(r).not.toBeNull();
    expect(r!.plan.inFront).toEqual([false, false, false, false]);
    expect(r!.plan.coveredShare).toBeCloseTo(0.05, 6);
    expect(r!.holes).toEqual([]);
  });

  it("sin datos, no", () => {
    expect(resolveSalaFuse(null, "Roma")).toBeNull();
    expect(resolveSalaFuse(undefined, "Roma")).toBeNull();
    expect(resolveSalaFuse({ letters: [], minContrast: 7 }, "Roma")).toBeNull();
  });

  it("si no se cumple el 3:1, no (y el 3:1 justo, sí)", () => {
    expect(resolveSalaFuse({ ...BUENO, minContrast: 2.99 }, "Roma")).toBeNull();
    expect(resolveSalaFuse({ ...BUENO, minContrast: 3 }, "Roma")).not.toBeNull();
    expect(resolveSalaFuse({ ...BUENO, minContrast: Number.NaN }, "Roma")).toBeNull();
    expect(resolveSalaFuse({ letters: BUENO.letters } as unknown as SalaFuseData, "Roma")).toBeNull();
  });

  it("si las medidas no son de este título, no", () => {
    expect(resolveSalaFuse(BUENO, "Parásitos")).toBeNull();
    // Los espacios no cuentan como letra.
    expect(salaFuseLetterCount("El viaje de Chihiro")).toBe(16);
    expect(salaFuseLetterCount("千と千尋の神隠し")).toBe(8);
  });

  it("con una medida imposible, no", () => {
    const mala = (l: Partial<SalaFuseLetter>) => ({ ...BUENO, letters: [{ ...BUENO.letters[0], ...l }, ...BUENO.letters.slice(1)] });
    expect(resolveSalaFuse(mala({ coveredPixels: 101 }), "Roma")).toBeNull();
    expect(resolveSalaFuse(mala({ coveredPixels: -1 }), "Roma")).toBeNull();
    expect(resolveSalaFuse(mala({ letterPixels: Number.NaN }), "Roma")).toBeNull();
    expect(resolveSalaFuse(mala({ line: 0.5 }), "Roma")).toBeNull();
  });

  it("si la figura no toca ninguna letra, no hay nada que fundir", () => {
    const limpio = { letters: BUENO.letters.map((l) => ({ ...l, coveredPixels: 0 })), minContrast: 7 };
    expect(resolveSalaFuse(limpio, "Roma")).toBeNull();
  });

  it("una letra tapada más del 35 % va entera por delante, con su caja", () => {
    const datos: SalaFuseData = { letters: [LETRA(0, 100, 36, 0.1), LETRA(0, 100, 20, 0.2), LETRA(0, 100, 0, 0.3), LETRA(0, 100, 0, 0.4)], minContrast: 5 };
    const r = resolveSalaFuse(datos, "Roma", 16 / 9)!;
    expect(r.plan.inFront).toEqual([true, false, false, false]);
    expect(r.holes).toHaveLength(1);
    // La caja, con su margen a los lados (no arriba ni abajo: es el alto de la línea).
    expect(r.holes[0].x).toBeLessThan(0.1);
    expect(r.holes[0].x + r.holes[0].width).toBeGreaterThan(0.18);
    expect(r.holes[0].y).toBe(0.7);
    expect(r.holes[0].height).toBeCloseTo(0.2, 9);
  });

  it("si a una letra que tiene que ir por delante le falta la caja, no hay fundido", () => {
    const datos: SalaFuseData = { letters: [{ line: 0, letterPixels: 100, coveredPixels: 60 }, LETRA(0, 100, 10, 0.2), LETRA(0, 100, 0, 0.3), LETRA(0, 100, 0, 0.4)], minContrast: 5 };
    expect(resolveSalaFuse(datos, "Roma")).toBeNull();
  });

  it("si todo queda por delante, no hay fundido", () => {
    const datos: SalaFuseData = { letters: [LETRA(0, 100, 90, 0.1), LETRA(0, 100, 80, 0.2), LETRA(0, 100, 70, 0.3), LETRA(0, 100, 60, 0.4)], minContrast: 5 };
    expect(resolveSalaFuse(datos, "Roma")).toBeNull();
  });
});

describe("el fondo del fundido", () => {
  it("la tinta, la figura encima y la tinta otra vez en las letras de delante", () => {
    const datos: SalaFuseData = { letters: [LETRA(0, 100, 36, 0.1), LETRA(0, 100, 20, 0.2), LETRA(0, 100, 0, 0.3), LETRA(0, 100, 0, 0.4)], minContrast: 5 };
    const fondo = salaFuseBackground(resolveSalaFuse(datos, "Roma")!, "/figura.png", "30% 40%");
    const capas = fondo.split(/,\s(?=linear-gradient|url)/);
    expect(capas).toHaveLength(3);
    expect(capas[0]).toMatch(/^linear-gradient\(var\(--sala-ink\), var\(--sala-ink\)\) [\d.]+% [\d.]+% \/ [\d.]+% 20% no-repeat$/);
    expect(capas[1]).toBe('url("/figura.png") 30% 40% / cover no-repeat');
    expect(capas[2]).toBe("linear-gradient(var(--sala-ink), var(--sala-ink))");
  });

  it("la dirección de la figura no puede romper la regla", () => {
    const fondo = salaFuseBackground(resolveSalaFuse(BUENO, "Roma")!, 'a") , url("b');
    // Las comillas van escapadas: sigue siendo una sola dirección, entre sus comillas.
    expect(fondo).toContain('url("a%22) , url(%22b")');
    expect(fondo.match(/"/g)).toHaveLength(2);
  });
});
