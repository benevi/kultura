/**
 * Tests unitarios — portadas al tamaño nativo del proveedor (E-PORTADAS-RAPIDAS).
 *
 * Fija la FORMA de las URL que se piden. Ojo: no prueba que cada CDN las
 * acepte (el proxy de estas pruebas no llega a los proveedores); eso se
 * comprueba en la preview.
 */
import { describe, it, expect } from "vitest";
import { backdropLoader, posterLoader } from "@/lib/images/poster-url";

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
      `/_next/image?url=${encodeURIComponent("https://uploads.mangadex.org/covers/m1/file.jpg.256.jpg")}&w=256&q=70`
    );
  });

  it("host desconocido: optimizador de Next", () => {
    expect(L("https://comicvine.gamespot.com/a/uploads/scale_medium/1.jpg", 256)).toMatch(/^\/_next\/image\?url=/);
  });

  // Cupo de Vercel Hobby (5.000 transformaciones al mes): cada ancho distinto
  // de la misma imagen es una transformación. MangaDex, ComicVine y Steam
  // siguen por el optimizador, pero con pocos anchos y una sola calidad.
  describe("optimizador: pocos anchos y una calidad", () => {
    const ALL_NEXT_WIDTHS = [16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840];
    const widthOf = (u: string) => Number(new URL(u, "https://x").searchParams.get("w"));
    const qualityOf = (u: string) => new URL(u, "https://x").searchParams.get("q");

    it.each([
      ["ComicVine", "https://comicvine.gamespot.com/a/uploads/scale_medium/1.jpg", [256, 640, 1080]],
      ["Steam", "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1/ss_a.600x338.jpg?t=1", [256, 640, 1080]],
      ["MangaDex", "https://uploads.mangadex.org/covers/m1/file.jpg", [256, 640]],
    ] as const)("%s: todos los anchos de next/image caen en %j", (_name, src, buckets) => {
      const urls = ALL_NEXT_WIDTHS.map((w) => L(src, w));
      for (const u of urls) {
        expect(u.startsWith("/_next/image?url=")).toBe(true);
        expect(qualityOf(u)).toBe("70");
      }
      expect(Array.from(new Set(urls.map(widthOf))).sort((a, b) => a - b)).toEqual(buckets);
    });

    it("redondea hacia arriba: nunca pide menos de lo que se va a pintar (hasta 1080)", () => {
      const src = "https://comicvine.gamespot.com/a/uploads/scale_medium/1.jpg";
      for (const w of ALL_NEXT_WIDTHS) {
        const got = widthOf(L(src, w));
        if (w <= 1080) expect(got).toBeGreaterThanOrEqual(w);
        else expect(got).toBe(1080);
      }
    });

    it("la calidad que llegue no cambia la URL (una sola transformación)", () => {
      const src = "https://comicvine.gamespot.com/a/uploads/scale_medium/1.jpg";
      expect(posterLoader({ src, width: 300, quality: 90 })).toBe(posterLoader({ src, width: 300 }));
    });

    it("los proveedores directos no pasan por el optimizador", () => {
      for (const src of [
        "https://image.tmdb.org/t/p/w500/abc.jpg",
        "https://media.rawg.io/media/games/1a2/shot.jpg",
        "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1.jpg",
        "https://covers.openlibrary.org/b/id/42-L.jpg",
        "https://books.google.com/books/content?id=x&img=1",
      ]) {
        for (const w of ALL_NEXT_WIDTHS) expect(L(src, w)).not.toMatch(/_next\/image/);
      }
    });
  });
});

// Fase 8.5 F2a: la apaisada de la sala pedía `original` (miles de px, varios MB)
// porque los anchos de póster de TMDB acaban en 780.
describe("backdropLoader", () => {
  const B = (src: string, width: number) => backdropLoader({ src, width });
  const src = "https://image.tmdb.org/t/p/w1280/fondo.jpg";

  // Decisión de Víctor (25-11-2026): directa de TMDB, w780 / w1280 / original
  // según la pantalla; original solo por encima de 1280 px físicos.
  it("TMDB: el ancho de fondo más pequeño que cubre; original por encima de w1280, directa del CDN", () => {
    expect(B(src, 256)).toBe("https://image.tmdb.org/t/p/w300/fondo.jpg");
    expect(B(src, 750)).toBe("https://image.tmdb.org/t/p/w780/fondo.jpg");
    expect(B(src, 1080)).toBe("https://image.tmdb.org/t/p/w1280/fondo.jpg");
    expect(B(src, 1200)).toBe("https://image.tmdb.org/t/p/w1280/fondo.jpg");
    for (const w of [1920, 2048, 3840]) expect(B(src, w)).toBe("https://image.tmdb.org/t/p/original/fondo.jpg");
    expect(B("https://image.tmdb.org/t/p/original/fondo.jpg", 750)).toBe("https://image.tmdb.org/t/p/w780/fondo.jpg");
  });

  it("TMDB con sizes=100vw: el srcset solo ofrece w780, w1280 y original", () => {
    // Anchos de `deviceSizes` por defecto: los que entran en el srcset con 100vw.
    const urls = new Set([640, 750, 828, 1080, 1200, 1920, 2048, 3840].map((w) => B(src, w)));
    expect(Array.from(urls)).toEqual([
      "https://image.tmdb.org/t/p/w780/fondo.jpg",
      "https://image.tmdb.org/t/p/w1280/fondo.jpg",
      "https://image.tmdb.org/t/p/original/fondo.jpg",
    ]);
  });

  it("los pósteres no cambian: posterLoader sigue pidiendo original por encima de 780", () => {
    expect(L("https://image.tmdb.org/t/p/w500/abc.jpg", 2000)).toBe("https://image.tmdb.org/t/p/original/abc.jpg");
  });

  it("RAWG: el endpoint de redimensionado con 1280 de tope (nunca la captura original)", () => {
    const shot = "https://media.rawg.io/media/games/1a2/shot.jpg";
    expect(B(shot, 384)).toBe("https://media.rawg.io/media/resize/420/-/games/1a2/shot.jpg");
    expect(B(shot, 1080)).toBe("https://media.rawg.io/media/resize/1280/-/games/1a2/shot.jpg");
    expect(B(shot, 3840)).toBe("https://media.rawg.io/media/resize/1280/-/games/1a2/shot.jpg");
    expect(B("https://media.rawg.io/media/resize/640/-/games/1a2/shot.jpg", 3840)).toBe(
      "https://media.rawg.io/media/resize/1280/-/games/1a2/shot.jpg"
    );
    // posterLoader no cambia: por encima de 1280, la original.
    expect(L(shot, 3840)).toBe("https://media.rawg.io/media/games/1a2/shot.jpg");
  });

  it("otros proveedores: lo mismo que posterLoader", () => {
    for (const s of [
      "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1.jpg",
      "https://covers.openlibrary.org/b/id/42-L.jpg",
      "https://example.org/x.jpg",
      "/local.jpg",
    ]) {
      for (const w of [200, 1080, 3840]) expect(B(s, w)).toBe(L(s, w));
    }
  });
});
