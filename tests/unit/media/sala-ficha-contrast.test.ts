/**
 * F6: el título de la sala de la ficha (y el original, pequeño) se lee sobre
 * cualquier imagen, también una blanca del todo. La sala pinta, de abajo
 * arriba: la imagen, el velo con el fondo de la paleta (`SALA_STAGE_VEIL`),
 * un negro fijo (`SALA_FICHA_SCRIM`) y la tinta (`--sala-ink`, tema oscuro).
 * Se mide el peor caso, una imagen blanca, con la paleta neutra y con las
 * paletas que salen de 300 portadas claras, y también sin contar el velo
 * (el negro fijo solo ya tiene que bastar).
 */
import { describe, expect, it } from "vitest";
import { SALA_STAGE_VEIL } from "@/components/sala/SalaStage";
import { SALA_FICHA_SCRIM, salaFichaTitleLang } from "@/components/media/sala/SalaFichaHero";
import { blend, contrastRatio, toSrgb, type Rgb } from "@/lib/design/color";
import { NEUTRAL_PALETTE, paletteFromPixels, type ImagePalette } from "@/lib/design/image-palette";

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Una portada clara: de 1 a 4 colores con todos los canales por encima de 180. */
function lightCover(rnd: () => number): number[] {
  const colors = Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => [
    180 + rnd() * 75,
    180 + rnd() * 75,
    180 + rnd() * 75,
  ]);
  const data: number[] = [];
  for (let i = 0; i < 64 * 64; i++) {
    const c = colors[i % colors.length];
    data.push(c[0], c[1], c[2], 255);
  }
  return data;
}

function titleContrast(palette: ImagePalette, image: Rgb, veil: number): number {
  const ink = toSrgb(palette.dark.ink)!;
  const background = toSrgb(palette.dark.background)!;
  // El velo sobre la imagen y, encima, el negro fijo.
  return contrastRatio(ink, blend(BLACK, blend(background, image, veil), SALA_FICHA_SCRIM));
}

describe("sala de la ficha: contraste del título sobre una imagen clara (F6)", () => {
  const palettes: ImagePalette[] = [NEUTRAL_PALETTE];
  const rnd = seeded(6);
  for (let n = 0; n < 300; n++) palettes.push(paletteFromPixels(lightCover(rnd)));

  it("con el velo, el original (pequeño) pasa de 4,5:1 sobre blanco", () => {
    for (const p of palettes) expect(titleContrast(p, WHITE, SALA_STAGE_VEIL)).toBeGreaterThanOrEqual(4.5);
  });

  it("sin contar el velo, el negro fijo solo deja el título a 3:1 y el original a 4,5:1", () => {
    for (const p of palettes) expect(titleContrast(p, WHITE, 0)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("salaFichaTitleLang: `lang` en el h1 (F6)", () => {
  const base = { title: "The Lord of the Rings", originalTitle: "The Lord of the Rings" };
  it("marca el idioma cuando el título que se ve es el original y no es el de la interfaz", () => {
    expect(salaFichaTitleLang({ ...base, metadata: { originalLanguage: "en" } }, "es")).toBe("en");
  });
  it("no lo marca si coincide con la interfaz, si no se sabe o si el título está traducido", () => {
    expect(salaFichaTitleLang({ ...base, metadata: { originalLanguage: "en" } }, "en")).toBeUndefined();
    expect(salaFichaTitleLang({ ...base, metadata: {} }, "es")).toBeUndefined();
    expect(salaFichaTitleLang({ ...base, metadata: { originalLanguage: "xx" } }, "es")).toBeUndefined();
    expect(
      salaFichaTitleLang(
        { title: "El señor de los anillos", originalTitle: "The Lord of the Rings", metadata: { originalLanguage: "en" } },
        "es"
      )
    ).toBeUndefined();
  });
});
