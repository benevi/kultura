import { describe, expect, it } from "vitest";
import { coverSource } from "@/lib/landing/cover-source";
import {
  buildShelf,
  isPublicManga,
  CURATED_BOOKS,
  CURATED_COMICS,
  monthIndex,
  monthlyWindow,
  type ShelfFormat,
  type ShelfItem,
} from "@/lib/landing/shelf";

const pool = (format: ShelfFormat, n = 5): ShelfItem[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${format}_${i}`, format, title: `${format} ${i}`, poster: `/${format}-${i}.jpg` }));

describe("estantería de la portada", () => {
  it("cambia de títulos al cambiar de mes, y no dentro del mes", () => {
    const list = Array.from({ length: 20 }, (_, i) => i);
    const nov1 = monthIndex(new Date("2026-11-01T00:00:00Z"));
    const nov30 = monthIndex(new Date("2026-11-30T23:59:59Z"));
    const dec = monthIndex(new Date("2026-12-01T00:00:00Z"));
    expect(nov1).toBe(nov30);
    expect(monthlyWindow(list, nov1)).toEqual(monthlyWindow(list, nov30));
    expect(monthlyWindow(list, dec)).not.toEqual(monthlyWindow(list, nov1));
  });

  it("una lista de cualquier largo recorre todos sus títulos", () => {
    for (const n of [4, 5, 9, 10, 20]) {
      const list = Array.from({ length: n }, (_, i) => i);
      const starts = new Set(Array.from({ length: n }, (_, m) => monthlyWindow(list, 24320 + m)[0]));
      expect(starts.size).toBe(n);
    }
    const nov = monthIndex(new Date("2026-11-01T00:00:00Z"));
    expect(monthlyWindow(CURATED_BOOKS, nov + 1)).not.toEqual(monthlyWindow(CURATED_BOOKS, nov));
  });

  it("no repite títulos en una ventana aunque la lista sea corta", () => {
    expect(new Set(monthlyWindow([1, 2, 3], 7)).size).toBe(3);
    expect(monthlyWindow([], 7)).toEqual([]);
  });

  it("arranca el abanico en una serie y enseña los siete formatos", () => {
    const shelf = buildShelf(Object.fromEntries((["tv", "movie", "anime", "manga", "book", "comic", "game"] as const).map((f) => [f, pool(f)])));
    expect(shelf.fan[shelf.start].format).toBe("tv");
    expect(new Set(shelf.fan.map((i) => i.format)).size).toBe(7);
    expect(new Set(shelf.fan.map((i) => i.id)).size).toBe(shelf.fan.length);
    expect(shelf.rows.map((i) => i.format)).toEqual(["game", "tv", "anime", "manga"]);
    expect(shelf.rows[0].id).not.toBe(shelf.fan[shelf.start].id);
    expect(shelf.byFormat.tv?.map((i) => i.id)).toEqual(["tv_2", "tv_3", "tv_4"]);
  });

  it("no deja huecos si falta un formato", () => {
    const shelf = buildShelf({ movie: pool("movie"), game: pool("game") });
    expect(shelf.fan.length).toBeGreaterThan(0);
    expect(shelf.fan[shelf.start]).toBeDefined();
    expect(shelf.byFormat.tv).toBeUndefined();
  });

  it("las listas revisadas tienen títulos únicos", () => {
    for (const list of [CURATED_BOOKS, CURATED_COMICS]) {
      expect(new Set(list.map((i) => i.title)).size).toBe(list.length);
    }
  });

  it("pide a cada CDN el mejor tamaño", () => {
    expect(coverSource("https://image.tmdb.org/t/p/w342/a.jpg").srcSet).toContain("/w780/a.jpg 780w");
    expect(coverSource("https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx1.jpg").src).toContain(
      encodeURIComponent("/cover/large/bx1.jpg"),
    );
    expect(coverSource("https://cdn.steamstatic.com/steam/apps/1/library_600x900_2x.jpg").srcSet).toContain("/library_600x900.jpg 300w");
    expect(coverSource("https://covers.openlibrary.org/b/id/1-L.jpg").srcSet).toContain("/b/id/1-M.jpg 180w");
    expect(coverSource("/landing/fallback/a.jpg")).toEqual({ src: "/landing/fallback/a.jpg" });
  });
});

describe("manga en la portada pública", () => {
  const manga = (genres: string[], tags: Array<{ name: string; rank: number; isAdult?: boolean }>) => ({ id: 1, genres, tags });

  it("deja pasar lo normal, aunque tenga violencia", () => {
    expect(isPublicManga(manga(["Action"], [{ name: "Gore", rank: 76 }, { name: "Torture", rank: 42 }]))).toBe(true);
  });

  it("una escena suelta no quita la obra", () => {
    expect(isPublicManga(manga(["Action"], [{ name: "Rape", rank: 45, isAdult: true }, { name: "Nudity", rank: 47 }]))).toBe(true);
  });

  it("quita géneros y etiquetas adultas que definen la obra", () => {
    expect(isPublicManga(manga(["Ecchi"], []))).toBe(false);
    expect(isPublicManga(manga(["Action"], [{ name: "Large Breasts", rank: 71, isAdult: true }]))).toBe(false);
    expect(isPublicManga(manga(["Comedy"], [{ name: "Female Harem", rank: 98 }]))).toBe(false);
    expect(isPublicManga(manga(["Action"], [{ name: "Nudity", rank: 73 }]))).toBe(false);
  });

  it("quita lo infantil con cualquier rango", () => {
    expect(isPublicManga(manga(["Comedy"], [{ name: "Kids", rank: 20 }]))).toBe(false);
  });

  it("sin etiquetas no entra", () => {
    expect(isPublicManga({ id: 1, genres: ["Action"], tags: null })).toBe(false);
  });
});

describe("portadas de AniList sin versión grande", () => {
  it("no pide /large/ si la portada no empieza por bx: esa ruta da 404", () => {
    const { src } = coverSource("https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/b156867-a.jpg");
    expect(src).toContain(encodeURIComponent("/cover/medium/b156867-a.jpg"));
  });
});
