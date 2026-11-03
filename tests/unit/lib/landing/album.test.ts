// ============================================================
// KULTURA — El álbum abierto de la portada: qué entra en cada página, quién
// ve la escena del sobre y cómo se mueve cada cromo.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  ALBUM_PAGE_SIZE,
  BURST_STAGGER_MS,
  LAND_AT,
  SPRING_DAMPING,
  SPRING_STIFFNESS,
  burstCount,
  burstMode,
  cromoPath,
  cromoProgress,
  isPortraitPoster,
  pickBestPage,
  pickMissingPage,
  scrollProgress,
  springSettled,
  springStep,
  textureUrl,
  type BurstEnv,
} from "@/lib/landing/album";
import type { MediaType } from "@/types/media";

const item = (type: MediaType, n: number, poster = `https://image.tmdb.org/t/p/w500/${type}-${n}.jpg`) => ({
  id: `${type}_${n}`,
  type,
  title: `${type} ${n}`,
  poster,
  rating: 8 + n / 10,
});

describe("páginas del álbum", () => {
  it("izquierda: los primeros de cada ranking alternando formato, sin capturas apaisadas", () => {
    const movie = [item("movie", 1), item("movie", 2), item("movie", 3)];
    const tv = [item("tv", 1), item("tv", 2)];
    const anime = [item("anime", 1), item("anime", 2), item("anime", 3)];
    const game = [item("game", 1, "https://media.rawg.io/media/games/x.jpg")];
    const page = pickBestPage([movie, tv, anime, game]);
    expect(page.map((p) => p.id)).toEqual([
      "movie_1",
      "tv_1",
      "anime_1",
      "movie_2",
      "tv_2",
      "anime_2",
      "movie_3",
      "anime_3",
    ]);
    expect(page).toHaveLength(ALBUM_PAGE_SIZE);
    expect(page.every((p) => !p.poster.includes("rawg"))).toBe(true);
    expect(page[0]).toMatchObject({ path: "/media/movie/1", rating: 8.1 });
  });

  it("derecha: uno de cada formato primero y nunca un título que ya está a la izquierda", () => {
    const showcase = [item("movie", 1), item("movie", 2), item("tv", 1), item("book", 1), item("book", 2), item("game", 1)];
    const page = pickMissingPage(showcase, ["movie_1"]);
    expect(page.map((p) => p.id)).toEqual(["movie_2", "tv_1", "book_1", "game_1", "book_2"]);
  });

  it("ningún cromo sin portada vertical", () => {
    expect(isPortraitPoster(null)).toBe(false);
    expect(isPortraitPoster("")).toBe(false);
    expect(isPortraitPoster("no es una url")).toBe(false);
    expect(isPortraitPoster("https://media.rawg.io/a.jpg")).toBe(false);
    expect(isPortraitPoster("https://cdn.steamstatic.com/steam/apps/1/library_600x900_2x.jpg")).toBe(true);
    expect(pickMissingPage([{ ...item("movie", 1), poster: "" }])).toEqual([]);
  });

  it("la ficha de cada cromo sale de su id o de su externalId", () => {
    expect(cromoPath({ id: "anime_al-1", type: "anime" })).toBe("/media/anime/al-1");
    expect(cromoPath({ id: "x", type: "book", externalId: "OL1 W" })).toBe("/media/book/OL1%20W");
  });

  // WebGL exige CORS: la textura sale del optimizador de Next (mismo origen).
  it("la textura de la escena es de mismo origen y de un solo ancho", () => {
    const src = "https://image.tmdb.org/t/p/w500/a b.jpg";
    expect(textureUrl(src)).toBe(`/_next/image?url=${encodeURIComponent(src)}&w=384&q=70`);
  });
});

describe("¿escena del sobre?", () => {
  const desktop: BurstEnv = { reducedMotion: false, webgl2: true, saveData: false, deviceMemory: 8, width: 1440, coarse: false };

  it("escritorio capaz: ligada al scroll, seis cromos", () => {
    expect(burstMode(desktop)).toBe("scroll");
    // Safari y Firefox no dan deviceMemory: no cuenta como equipo justo.
    expect(burstMode({ ...desktop, deviceMemory: undefined })).toBe("scroll");
    expect(burstCount("scroll", true, 8)).toBe(6);
  });

  it("móvil o táctil: una sola pasada y cuatro cromos", () => {
    expect(burstMode({ ...desktop, width: 390 })).toBe("once");
    expect(burstMode({ ...desktop, coarse: true })).toBe("once");
    expect(burstCount("once", true, 8)).toBe(4);
    expect(burstCount("once", false, 8)).toBe(4);
  });

  it("álbum quieto con movimiento reducido, sin WebGL 2, ahorro de datos o menos de 4 GB", () => {
    expect(burstMode({ ...desktop, reducedMotion: true })).toBe("static");
    expect(burstMode({ ...desktop, webgl2: false })).toBe("static");
    expect(burstMode({ ...desktop, saveData: true })).toBe("static");
    expect(burstMode({ ...desktop, deviceMemory: 2 })).toBe("static");
    expect(burstMode({ ...desktop, deviceMemory: 4 })).toBe("scroll");
  });

  it("los huecos que llena el respaldo quieto son los mismos que llenaría la escena", () => {
    expect(burstCount("static", true, 8)).toBe(burstCount("scroll", true, 8));
    expect(burstCount("static", false, 8)).toBe(burstCount("once", false, 8));
    expect(burstCount("scroll", true, 3)).toBe(3);
    expect(burstCount("scroll", true, 0)).toBe(0);
  });
});

describe("movimiento de cada cromo", () => {
  it("muelle de rigidez 170 y amortiguación 26", () => {
    expect(SPRING_STIFFNESS).toBe(170);
    expect(SPRING_DAMPING).toBe(26);
  });

  it("llega al hueco en menos de 600 ms, sin pasarse más de un 2 % ni rebotar en bucle", () => {
    let s = { x: 0, v: 0 };
    let max = 0;
    let arrived = -1;
    for (let ms = 0; ms < 1500; ms += 16) {
      s = springStep(s, 1, 0.016);
      max = Math.max(max, s.x);
      if (arrived < 0 && s.x >= LAND_AT) arrived = ms + 16;
    }
    expect(arrived).toBeGreaterThan(0);
    expect(arrived).toBeLessThanOrEqual(600);
    expect(max).toBeLessThan(1.02);
    expect(springSettled(s, 1)).toBe(true);
  });

  it("un fotograma largo no lo dispara (subpasos)", () => {
    const s = springStep({ x: 0, v: 0 }, 1, 0.5);
    expect(s.x).toBeGreaterThan(0);
    expect(s.x).toBeLessThan(1.05);
  });

  it("salen escalonados y todos llegan al final del recorrido", () => {
    expect(cromoProgress(0, 0, 6)).toBe(0);
    expect(cromoProgress(1, 5, 6)).toBe(1);
    expect(cromoProgress(0.2, 0, 6)).toBeGreaterThan(cromoProgress(0.2, 3, 6));
    for (let i = 0; i < 6; i++) expect(cromoProgress(1, i, 6)).toBe(1);
  });

  it("40 ms entre cromo y cromo en la pasada única: el último arranca a los 120 ms", () => {
    expect(BURST_STAGGER_MS).toBe(40);
    expect((burstCount("once", false, 8) - 1) * BURST_STAGGER_MS).toBeLessThanOrEqual(600);
  });

  it("el scroll de la primera pantalla marca el avance de 0 a 1", () => {
    expect(scrollProgress(0, 0, 400)).toBe(0);
    expect(scrollProgress(200, 0, 400)).toBe(0.5);
    expect(scrollProgress(5000, 0, 400)).toBe(1);
    expect(scrollProgress(-50, 0, 400)).toBe(0);
  });
});
