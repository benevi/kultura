// @vitest-environment jsdom
/**
 * Tests unitarios — tamaño real del archivo de una imagen ya cargada.
 *
 * El `naturalWidth` de un <img> con `srcset` de descriptores `w` y `sizes` no
 * es el del archivo: viene dividido por la densidad del candidato. El tope de
 * ampliación (biblia §2) tiene que medir el archivo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetMeasuredFiles, measureImageFile } from "@/lib/images/file-size";

/** Los `Image` sueltos que se han creado para medir, con lo que se les pidió. */
let sondas: Array<{ src: string; cargar: (ancho: number, alto: number) => void; fallar: () => void }>;

beforeEach(() => {
  sondas = [];
  forgetMeasuredFiles();
  vi.stubGlobal(
    "Image",
    class {
      naturalWidth = 0;
      naturalHeight = 0;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(valor: string) {
        sondas.push({
          src: valor,
          cargar: (ancho, alto) => {
            this.naturalWidth = ancho;
            this.naturalHeight = alto;
            this.onload?.();
          },
          fallar: () => this.onerror?.(),
        });
      }
    }
  );
});

afterEach(() => vi.unstubAllGlobals());

/** Un <img> ya cargado: lo que dice medir, y qué archivo eligió el navegador. */
function imagen({ dice, srcset = "", currentSrc = "" }: { dice: [number, number]; srcset?: string; currentSrc?: string }) {
  const img = document.createElement("img");
  if (srcset) img.setAttribute("srcset", srcset);
  Object.defineProperty(img, "naturalWidth", { value: dice[0] });
  Object.defineProperty(img, "naturalHeight", { value: dice[1] });
  Object.defineProperty(img, "currentSrc", { value: currentSrc });
  return img;
}

const SRCSET = "https://image.tmdb.org/t/p/w500/a.jpg 640w, https://image.tmdb.org/t/p/w780/a.jpg 750w";
const ELEGIDO = "https://image.tmdb.org/t/p/w780/a.jpg";

describe("measureImageFile", () => {
  it("sin srcset, lo que dice la imagen es el archivo: no se pide nada más", async () => {
    await expect(measureImageFile(imagen({ dice: [96, 144] }))).resolves.toEqual({ width: 96, height: 144 });
    expect(sondas).toHaveLength(0);
  });

  it("con srcset mide el archivo que eligió el navegador (currentSrc), no lo que dice el <img>", async () => {
    // TMDB w780 pedido como 750w para una caja de 175,5 px: el <img> dice 183 × 274.
    const medida = measureImageFile(imagen({ dice: [183, 274], srcset: SRCSET, currentSrc: ELEGIDO }));
    expect(sondas.map((s) => s.src)).toEqual([ELEGIDO]);
    sondas[0].cargar(780, 1170);
    await expect(medida).resolves.toEqual({ width: 780, height: 1170 });
  });

  it("el mismo archivo se mide una vez, lo pinten una imagen o cien", async () => {
    const medidas = Array.from({ length: 100 }, () => measureImageFile(imagen({ dice: [183, 274], srcset: SRCSET, currentSrc: ELEGIDO })));
    expect(sondas).toHaveLength(1);
    sondas[0].cargar(780, 1170);
    for (const medida of medidas) await expect(medida).resolves.toEqual({ width: 780, height: 1170 });
  });

  it("si el archivo no se puede volver a leer, se rechaza y la próxima vez se intenta de nuevo", async () => {
    const primera = measureImageFile(imagen({ dice: [183, 274], srcset: SRCSET, currentSrc: ELEGIDO }));
    sondas[0].fallar();
    await expect(primera).rejects.toThrow();
    const segunda = measureImageFile(imagen({ dice: [183, 274], srcset: SRCSET, currentSrc: ELEGIDO }));
    expect(sondas).toHaveLength(2);
    sondas[1].cargar(780, 1170);
    await expect(segunda).resolves.toEqual({ width: 780, height: 1170 });
  });
});
