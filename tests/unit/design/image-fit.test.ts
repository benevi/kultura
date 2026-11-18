/**
 * @vitest-environment node
 *
 * Tests unitarios — tope de ampliación de la imagen de la sala (biblia, §2):
 * ninguna imagen se amplía por encima de 1,25× su tamaño natural; si ninguna
 * de la obra llena la sala sin pasarse, la obra se compone como un libro.
 * Medidas en píxeles físicos.
 */
import { describe, it, expect } from "vitest";
import { IMAGE_MAX_UPSCALE, chooseRoomLayout, fillsRoom, roomScale } from "@/lib/design/image-fit";

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
