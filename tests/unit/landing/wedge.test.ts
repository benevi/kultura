// F1 (D2): cada mini-landing de cuña tiene siempre una portada vertical de su formato.
import { describe, it, expect } from "vitest";
import { buildLandingScenes, FALLBACK_MEDIA } from "@/lib/landing/scenes";
import { pickWedgePoster, WEDGE_TYPES } from "@/lib/landing/wedge";
import { WEDGES } from "@/lib/analytics/attribution";
import { sceneInk } from "@/components/landing/WedgeLanding";

describe("pickWedgePoster", () => {
  it.each(WEDGES)("%s: con la tabla vacía usa el respaldo, vertical y del formato de la cuña", (wedge) => {
    const m = pickWedgePoster(buildLandingScenes([]), wedge);
    expect(m).toBeTruthy();
    expect(WEDGE_TYPES[wedge]).toContain(m.type);
    expect(m.height).toBeGreaterThan(m.width);
  });

  it("prefiere la imagen de la semana y el formato preferido (tv antes que movie)", () => {
    const week = FALLBACK_MEDIA.filter((m) => m.slot === "feature").map((m) => ({ ...m, image: `/week/${m.position}.jpg` }));
    const m = pickWedgePoster(buildLandingScenes(week), "series");
    expect(m.type).toBe("tv");
    expect(m.image.startsWith("/week/")).toBe(true);
  });

  it("nunca usa las imágenes del ranking (la portada ya no las pinta)", () => {
    for (const wedge of WEDGES) expect(pickWedgePoster(buildLandingScenes([]), wedge).slot).not.toBe("ranking");
  });
});

describe("sceneInk (texto del CTA sobre el color de la escena)", () => {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * lin(((n >> 16) & 255) / 255) + 0.7152 * lin(((n >> 8) & 255) / 255) + 0.0722 * lin((n & 255) / 255);
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [L(a), L(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  it.each(WEDGES)("%s: el CTA del respaldo cumple 4,5:1 (WCAG AA)", (wedge) => {
    const { accent } = pickWedgePoster(buildLandingScenes([]), wedge);
    expect(ratio(accent, sceneInk(accent))).toBeGreaterThanOrEqual(4.5);
  });

  it("un color no válido cae en la tinta oscura por defecto", () => {
    expect(sceneInk("rojo")).toBe("#0a0a0a");
  });
});
