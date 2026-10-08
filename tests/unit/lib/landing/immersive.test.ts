import { describe, it, expect } from "vitest";
import {
  FORMAT_FROM,
  FORMAT_TO,
  IMMERSIVE_FORMATS,
  formatIndexAt,
  textureUrl,
} from "@/lib/landing/immersive";

describe("hero inmersivo · helpers", () => {
  it("el primer formato cubre el arranque y el último el final del tramo", () => {
    expect(formatIndexAt(0)).toBe(0);
    expect(formatIndexAt(FORMAT_FROM)).toBe(0);
    expect(formatIndexAt(FORMAT_TO)).toBe(IMMERSIVE_FORMATS.length - 1);
    expect(formatIndexAt(1)).toBe(IMMERSIVE_FORMATS.length - 1);
  });

  it("recorre los siete formatos en orden a lo largo del tramo", () => {
    const span = FORMAT_TO - FORMAT_FROM;
    const seen = IMMERSIVE_FORMATS.map((_, i) =>
      formatIndexAt(FORMAT_FROM + span * ((i + 0.5) / IMMERSIVE_FORMATS.length))
    );
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  // WebGL exige CORS para subir una imagen a la GPU: la textura se pide al
  // optimizador de Next (MISMO origen), nunca al CDN del proveedor.
  it("la textura sale del mismo origen, con la URL del proveedor codificada", () => {
    const src = "https://image.tmdb.org/t/p/w500/a b.jpg";
    const url = textureUrl(src);
    expect(url.startsWith("/_next/image?url=")).toBe(true);
    expect(url).toContain(encodeURIComponent(src));
    expect(url).toContain("w=384");
  });
});
