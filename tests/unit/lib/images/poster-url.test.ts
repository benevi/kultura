/**
 * Tests unitarios — portadas al tamaño nativo del proveedor (E-PORTADAS-RAPIDAS).
 *
 * Fija la FORMA de las URL que se piden. Ojo: no prueba que cada CDN las
 * acepte (el proxy de estas pruebas no llega a los proveedores); eso se
 * comprueba en la preview.
 */
import { describe, it, expect } from "vitest";
import { posterLoader } from "@/lib/images/poster-url";

const L = (src: string, width: number) => posterLoader({ src, width });

describe("posterLoader", () => {
  it("TMDB: el tamaño nativo más pequeño que cubre el ancho", () => {
    const src = "https://image.tmdb.org/t/p/w500/abc.jpg";
    expect(L(src, 140)).toBe("https://image.tmdb.org/t/p/w154/abc.jpg");
    expect(L(src, 300)).toBe("https://image.tmdb.org/t/p/w342/abc.jpg");
    expect(L(src, 2000)).toBe("https://image.tmdb.org/t/p/original/abc.jpg");
  });

  it("RAWG: usa el endpoint de redimensionado, no la captura original", () => {
    const src = "https://media.rawg.io/media/games/1a2/shot.jpg";
    expect(L(src, 384)).toBe("https://media.rawg.io/media/resize/420/-/games/1a2/shot.jpg");
    // Una URL ya redimensionada no se redimensiona dos veces.
    expect(L("https://media.rawg.io/media/resize/640/-/games/1a2/shot.jpg", 150)).toBe(
      "https://media.rawg.io/media/resize/200/-/games/1a2/shot.jpg"
    );
  });

  // Regresión: reescribir la carpeta de tamaño de AniList pedía
  // `/cover/extraLarge/`, que no existe → Anime entero en 404.
  it("AniList: la URL se sirve tal cual, sin tocar la carpeta de tamaño", () => {
    const src = "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1.jpg";
    for (const w of [96, 200, 384, 828]) expect(L(src, w)).toBe(src);
  });

  it("Open Library: cambia el sufijo de tamaño", () => {
    expect(L("https://covers.openlibrary.org/b/id/42-L.jpg", 150)).toBe("https://covers.openlibrary.org/b/id/42-M.jpg");
    expect(L("https://covers.openlibrary.org/b/id/42-L.jpg", 400)).toBe("https://covers.openlibrary.org/b/id/42-L.jpg");
  });

  it("MangaDex: miniatura al optimizador, sin duplicar el sufijo", () => {
    const out = L("https://uploads.mangadex.org/covers/m1/file.jpg.512.jpg", 200);
    expect(out).toBe(
      `/_next/image?url=${encodeURIComponent("https://uploads.mangadex.org/covers/m1/file.jpg.256.jpg")}&w=200&q=70`
    );
  });

  it("host desconocido: optimizador de Next", () => {
    expect(L("https://comicvine.gamespot.com/a/uploads/scale_medium/1.jpg", 256)).toMatch(/^\/_next\/image\?url=/);
  });
});
