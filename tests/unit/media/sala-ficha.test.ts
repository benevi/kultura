// ============================================================
// Fase 8.5 · F1: composición de la sala de la ficha, título original con su
// idioma y qué imágenes se pueden leer para sacar el color.
// ============================================================

import { describe, expect, it } from "vitest";
import { originalTitleOf, scriptLang } from "@/lib/media/original-title";
import { salaFichaColumnPoster, salaFichaLayout } from "@/components/media/sala/SalaFichaHero";
import { paletteReadable } from "@/components/media/sala/SalaFichaImage";
import type { MediaItem } from "@/types/media";

const item = (over: Partial<MediaItem>): MediaItem => ({ id: "x", externalId: "1", type: "movie", title: "T", ...over });

describe("salaFichaLayout", () => {
  it("película, serie, juego y anime con apaisada: la sala", () => {
    for (const type of ["movie", "tv", "game", "anime"] as const) {
      expect(salaFichaLayout(item({ type, backdrop: "b", poster: "p" }))).toBe("stage");
    }
  });
  it("libro, manga y cómic: la portada como pieza, aunque haya apaisada", () => {
    for (const type of ["book", "manga", "comic"] as const) {
      expect(salaFichaLayout(item({ type, backdrop: "b", poster: "p" }))).toBe("piece");
    }
  });
  it("juegos: la imagen de RAWG (llega como poster) es la apaisada", () => {
    expect(salaFichaLayout(item({ type: "game", poster: "p" }))).toBe("stage");
  });
  it("sin apaisada: la vertical llena la sala (F4); sin ninguna imagen: el campo de color", () => {
    for (const type of ["movie", "tv", "anime"] as const) {
      expect(salaFichaLayout(item({ type, poster: "p" }))).toBe("poster");
    }
    expect(salaFichaLayout(item({ type: "movie" }))).toBe("empty");
  });
});

describe("salaFichaColumnPoster (F2a)", () => {
  it("película, serie y anime con apaisada: el póster vertical es otra imagen y se queda", () => {
    for (const type of ["movie", "tv", "anime"] as const) {
      expect(salaFichaColumnPoster(item({ type, backdrop: "b", poster: "p" }))).toBe(true);
    }
  });
  it("película o serie sin apaisada: la sala ya es la vertical, no se repite", () => {
    for (const type of ["movie", "tv", "anime"] as const) {
      expect(salaFichaLayout(item({ type, poster: "p" }))).toBe("poster");
      expect(salaFichaColumnPoster(item({ type, poster: "p" }))).toBe(false);
    }
  });
  it("libro, manga y cómic: tampoco, aunque traigan apaisada", () => {
    for (const type of ["book", "manga", "comic"] as const) {
      expect(salaFichaColumnPoster(item({ type, backdrop: "b", poster: "p" }))).toBe(false);
    }
  });
  it("juegos: la imagen de RAWG es la sala; con apaisada propia distinta, el póster sí", () => {
    expect(salaFichaColumnPoster(item({ type: "game", poster: "p" }))).toBe(false);
    expect(salaFichaColumnPoster(item({ type: "game", backdrop: "b", poster: "p" }))).toBe(true);
  });
  it("sin póster: nada en la columna (ni el degradado)", () => {
    expect(salaFichaColumnPoster(item({ type: "movie", backdrop: "b" }))).toBe(false);
    expect(salaFichaColumnPoster(item({ type: "movie" }))).toBe(false);
  });
});

describe("originalTitleOf", () => {
  it("coreano y japonés por su escritura", () => {
    expect(originalTitleOf(item({ title: "Parásitos", originalTitle: "기생충" }))).toEqual({ text: "기생충", lang: "ko" });
    expect(originalTitleOf(item({ title: "El viaje de Chihiro", originalTitle: "千と千尋の神隠し" }))).toEqual({
      text: "千と千尋の神隠し",
      lang: "ja",
    });
  });
  it("el idioma que declara TMDB manda", () => {
    expect(
      originalTitleOf(item({ type: "tv", title: "La casa de papel", originalTitle: "Money Heist", metadata: { originalLanguage: "en" } }))
    ).toEqual({ text: "Money Heist", lang: "en" });
  });
  it("AniList: el nativo, y solo kanji sigue siendo japonés", () => {
    expect(
      originalTitleOf(item({ type: "anime", title: "Jujutsu Kaisen", originalTitle: "Jujutsu Kaisen", metadata: { nativeTitle: "呪術廻戦" } }))
    ).toEqual({ text: "呪術廻戦", lang: "ja" });
  });
  it("el romaji, como japonés en letra latina", () => {
    expect(originalTitleOf(item({ type: "anime", title: "Attack on Titan", originalTitle: "Shingeki no Kyojin" }))).toEqual({
      text: "Shingeki no Kyojin",
      lang: "ja-Latn",
    });
  });
  it("sin idioma seguro: se enseña sin marcar; igual al título o vacío: nada", () => {
    expect(originalTitleOf(item({ title: "Amélie", originalTitle: "Le Fabuleux Destin d'Amélie Poulain" }))?.lang).toBeNull();
    expect(originalTitleOf(item({ title: "Up", originalTitle: "Up" }))).toBeNull();
    expect(originalTitleOf(item({ title: "Up" }))).toBeNull();
    expect(scriptLang("卧虎藏龙")).toBeNull();
  });
  it("idioma de TMDB: cn → yue; xx sin marcar; películas también", () => {
    const o = (lang: string, originalTitle = "x original") =>
      originalTitleOf(item({ title: "X", originalTitle, metadata: { originalLanguage: lang } }))?.lang;
    expect(o("fr", "Le Fabuleux Destin d'Amélie Poulain")).toBe("fr");
    expect(o("cn", "英雄本色")).toBe("yue");
    expect(o("zh", "霸王别姬")).toBe("zh");
    expect(o("xx")).toBeNull();
    expect(o("zxx")).toBeNull();
  });
});

describe("paletteReadable", () => {
  it("TMDB, RAWG, Open Library y el optimizador: sí", () => {
    for (const src of [
      "https://image.tmdb.org/t/p/w1280/a.jpg",
      "https://media.rawg.io/media/games/a.jpg",
      "https://covers.openlibrary.org/b/id/1-L.jpg",
      "/_next/image?url=x",
    ]) {
      expect(paletteReadable(src)).toBe(true);
    }
  });
  it("Google Books y AniList: no (sin CORS fiable, pedirla con CORS la rompería)", () => {
    expect(paletteReadable("https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/a.png")).toBe(false);
    expect(paletteReadable("https://books.google.com/books/content?id=x")).toBe(false);
    expect(paletteReadable("https://books.googleusercontent.com/x")).toBe(false);
  });
});
