/**
 * @vitest-environment node
 *
 * Tests unitarios — tope de ampliación de la imagen de la sala (biblia, §2):
 * ninguna imagen se amplía por encima de 1,25× su tamaño natural; si ninguna
 * de la obra llena la sala sin pasarse, la obra se compone como un libro.
 * Medidas en píxeles físicos.
 */
import { describe, it, expect } from "vitest";
import { IMAGE_MAX_UPSCALE, chooseRoomLayout, fillsRoom, posterFit, roomScale } from "@/lib/design/image-fit";

describe("tope de ampliación (1,25×)", () => {
  it("el tope es 1,25", () => {
    expect(IMAGE_MAX_UPSCALE).toBe(1.25);
  });

  it("la escala es la de llenar la sala recortando (la mayor de las dos)", () => {
    expect(roomScale({ width: 1000, height: 500 }, { width: 1000, height: 500 })).toBe(1);
    expect(roomScale({ width: 2000, height: 1000 }, { width: 1000, height: 500 })).toBe(0.5);
    // Imagen vertical en sala apaisada: manda el ancho.
    expect(roomScale({ width: 1000, height: 1500 }, { width: 2000, height: 900 })).toBe(2);
    // Imagen apaisada en sala vertical (móvil): manda el alto.
    expect(roomScale({ width: 1920, height: 1080 }, { width: 1170, height: 1462 })).toBeCloseTo(1462 / 1080, 10);
  });

  it("justo en el límite: 1,25× llena la sala; un píxel más, no", () => {
    const natural = { width: 1000, height: 800 };
    expect(fillsRoom(natural, { width: 1250, height: 1000 })).toBe(true);
    expect(fillsRoom(natural, { width: 1251, height: 1000 })).toBe(false);
    expect(fillsRoom(natural, { width: 1250, height: 1001 })).toBe(false);
    expect(fillsRoom(natural, { width: 1249, height: 999 })).toBe(true);
  });

  it("medidas que no valen nunca llenan la sala", () => {
    const room = { width: 1440, height: 810 };
    expect(fillsRoom({ width: 0, height: 0 }, room)).toBe(false);
    expect(fillsRoom({ width: NaN, height: 800 }, room)).toBe(false);
    expect(fillsRoom({ width: -100, height: 800 }, room)).toBe(false);
    expect(fillsRoom({ width: 4000, height: 2000 }, { width: 0, height: 0 })).toBe(false);
    expect(roomScale({ width: 0, height: 10 }, room)).toBe(Infinity);
  });

  it("elige la primera imagen que da, por orden de preferencia", () => {
    const room = { width: 2880, height: 1620 }; // 1440 × 810 CSS a 2×
    // El banner de 1900 × 400 no da (1620 / 400 = 4,05×); la vertical de 2400 × 3600 sí (1,2×).
    expect(
      chooseRoomLayout(
        [
          { width: 1900, height: 400 },
          { width: 2400, height: 3600 },
        ],
        room,
      ),
    ).toEqual({ layout: "room", index: 1, scale: 1.2 });
    // Si la apaisada da, gana aunque la vertical también dé.
    expect(
      chooseRoomLayout(
        [
          { width: 3840, height: 2160 },
          { width: 2400, height: 3600 },
        ],
        room,
      ),
    ).toEqual({ layout: "room", index: 0, scale: 0.75 });
  });

  it("si ninguna da, ni apaisada ni vertical, la obra se compone como un libro", () => {
    const room = { width: 2880, height: 1620 };
    expect(
      chooseRoomLayout(
        [
          { width: 1900, height: 400 },
          { width: 600, height: 900 },
        ],
        room,
      ),
    ).toEqual({ layout: "book" });
    expect(chooseRoomLayout([], room)).toEqual({ layout: "book" });
    // La misma portada sí llena una sala pequeña (un móvil a 1×).
    expect(chooseRoomLayout([{ width: 600, height: 900 }], { width: 375, height: 469 }).layout).toBe("room");
  });
});

describe("póster con tope: llena o pieza (posterFit)", () => {
  const VERTICAL = { width: 240, height: 360 };

  it("una imagen que da para la caja la llena; justo en el tope también", () => {
    expect(posterFit({ width: 480, height: 720 }, { width: 320, height: 480 }, 1)).toEqual({ frame: "fill" });
    expect(posterFit({ width: 256, height: 384 }, { width: 320, height: 480 }, 1)).toEqual({ frame: "fill" });
  });

  it("la que se queda corta va entera, a 1,25 veces su archivo como mucho, en píxeles físicos", () => {
    expect(posterFit({ width: 96, height: 144 }, VERTICAL, 1)).toEqual({ frame: "piece", scale: 0.5, width: 120, height: 180 });
    // A densidad 2 la misma caja tiene el doble de píxeles y la pieza ocupa la mitad de píxeles CSS.
    expect(posterFit({ width: 96, height: 144 }, { width: 480, height: 720 }, 2)).toEqual({ frame: "piece", scale: 0.25, width: 60, height: 90 });
  });

  it("una apaisada en una caja vertical cabe entera y no pasa del tope", () => {
    const pieza = posterFit({ width: 320, height: 180 }, VERTICAL, 1);
    // Entera ya ocupa todo el ancho (reducida a 0,75): no hay que encogerla más.
    expect(pieza).toEqual({ frame: "piece", scale: 1, width: 240, height: 135 });
  });

  it("con contain solo cuenta que quepa entera", () => {
    expect(posterFit({ width: 320, height: 180 }, VERTICAL, 1, "contain")).toEqual({ frame: "fill" });
    expect(posterFit({ width: 96, height: 144 }, VERTICAL, 1, "contain")).toEqual({ frame: "piece", scale: 0.5, width: 120, height: 180 });
  });

  it("sin medidas no decide", () => {
    expect(posterFit({ width: 0, height: 0 }, VERTICAL, 1)).toBeNull();
    expect(posterFit({ width: 96, height: 144 }, { width: 0, height: 0 }, 1)).toBeNull();
    expect(posterFit({ width: 96, height: 144 }, VERTICAL, 0)).toBeNull();
  });

  // La regresión de la revisión de la 8.4: el tope se midió con el `naturalWidth`
  // de un <img> con `srcset` de descriptores `w` y `sizes`, que el navegador da
  // dividido por la densidad del candidato: ancho del archivo × sizes ÷ descriptor.
  // Con ese número casi toda portada salía como pieza a densidad 2 y 3.
  describe("se mide con el archivo, no con lo que dice un <img> con srcset", () => {
    /** Lo que da `naturalWidth` × `naturalHeight` con `srcset` + `sizes`. */
    const declarado = (archivo: { width: number; height: number }, sizes: number, descriptor: number) => ({
      width: Math.round((archivo.width * sizes) / descriptor),
      height: Math.round((archivo.height * sizes) / descriptor),
    });
    const caja = (ancho: number, dpr: number) => ({ width: ancho * dpr, height: ancho * 1.5 * dpr });

    it.each([
      // proveedor, archivo, ancho de la caja (CSS), sizes (px), descriptor elegido, densidad, lo que dice el <img>, lo que toca
      ["TMDB w780, móvil", { width: 780, height: 1170 }, 171, 175.5, 750, 3, 183, "fill"],
      ["AniList 460 (la misma URL en todos los candidatos)", { width: 460, height: 650 }, 171, 175.5, 3840, 3, 21, "fill"],
      ["TMDB w500, portátil", { width: 500, height: 750 }, 195, 195, 640, 2, 152, "fill"],
      ["TMDB w342, escritorio", { width: 342, height: 513 }, 192, 192, 256, 1, 257, "fill"],
      ["Open Library L", { width: 500, height: 750 }, 171, 175.5, 640, 3, 137, "fill"],
      ["Google Books 128", { width: 128, height: 192 }, 171, 175.5, 640, 3, 35, "piece"],
      ["Google Books 128", { width: 128, height: 192 }, 195, 195, 640, 2, 39, "piece"],
    ] as const)("%s: caja de %o… → %s", (_caso, archivo, ancho, sizes, descriptor, dpr, dice, toca) => {
      const delImg = declarado(archivo, sizes, descriptor);
      expect(delImg.width).toBe(dice);
      // Con el archivo, lo que toca.
      expect(posterFit(archivo, caja(ancho, dpr), dpr)?.frame).toBe(toca);
      // Y nunca más de 1,25 veces el archivo.
      const ajuste = posterFit(archivo, caja(ancho, dpr), dpr)!;
      if (ajuste.frame === "piece") expect((ajuste.width * dpr) / archivo.width).toBeLessThanOrEqual(IMAGE_MAX_UPSCALE + 0.01);
      // Con lo que dice el <img>, a densidad 2 y 3 todo salía pieza: por eso no vale.
      if (dpr > 1) expect(posterFit(delImg, caja(ancho, dpr), dpr)?.frame).toBe("piece");
    });

    it("la pieza de una portada de 128 px mide 53 px CSS a densidad 3 y 80 a densidad 2", () => {
      const archivo = { width: 128, height: 192 };
      expect(posterFit(archivo, caja(171, 3), 3)).toMatchObject({ frame: "piece", width: 53, height: 80 });
      expect(posterFit(archivo, caja(195, 2), 2)).toMatchObject({ frame: "piece", width: 80, height: 120 });
    });
  });
});
