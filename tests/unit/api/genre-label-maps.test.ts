import { describe, it, expect } from "vitest";
import es from "../../../messages/es.json";
import en from "../../../messages/en.json";
import {
  genreLabelSlug,
  localizeGenreLabel,
  localizeGenreLabels,
} from "@/lib/api/genre-label-maps";
import { TMDB_GENRE_LABEL } from "@/lib/api/tmdb-maps";
import { RAWG_GENRE_LABEL } from "@/lib/api/rawg-maps";
import { ANILIST_GENRE_LABEL } from "@/lib/api/anilist-maps";

describe("genre-label-maps (DAT-2)", () => {
  it("traduce los combinados de TMDB TV que llegan en inglés con es-ES", () => {
    expect(localizeGenreLabel("Sci-Fi & Fantasy", "es")).toBe("Ciencia ficción y fantasía");
    expect(localizeGenreLabel("Action & Adventure", "es")).toBe("Acción y aventura");
    expect(localizeGenreLabel("War & Politics", "es")).toBe("Bélica y política");
    expect(localizeGenreLabel("Kids", "es")).toBe("Infantil");
    expect(localizeGenreLabel("Soap", "es")).toBe("Telenovela");
  });

  it("traduce los géneros de AniList y RAWG", () => {
    expect(localizeGenreLabels(["Action", "Slice of Life", "Supernatural"], "es")).toEqual([
      "Acción",
      "Recuentos de la vida",
      "Sobrenatural",
    ]);
    expect(localizeGenreLabels(["RPG", "Platformer", "Massively Multiplayer"], "es")).toEqual([
      "RPG",
      "Plataformas",
      "Multijugador masivo",
    ]);
  });

  it("en /en pinta inglés aunque el proveedor lo sirviera en español", () => {
    expect(localizeGenreLabel("Ciencia ficción", "en")).toBe("Sci-Fi");
    expect(localizeGenreLabel("Acción", "en")).toBe("Action");
    expect(localizeGenreLabel("Action", "en")).toBe("Action");
  });

  it("lo desconocido se deja tal cual y no se repiten etiquetas", () => {
    expect(localizeGenreLabel("Kaiju", "es")).toBe("Kaiju");
    expect(genreLabelSlug("Kaiju")).toBeNull();
    expect(localizeGenreLabels(["Action", "Acción", "", "Action"], "es")).toEqual(["Acción"]);
  });

  it("cada slug de las tablas tiene texto en los dos idiomas", () => {
    const slugs = [
      ...Object.values(TMDB_GENRE_LABEL),
      ...Object.values(RAWG_GENRE_LABEL),
      ...Object.values(ANILIST_GENRE_LABEL),
    ];
    const esGenre = es.discoverFilters.options.genre as Record<string, string>;
    const enGenre = en.discoverFilters.options.genre as Record<string, string>;
    for (const slug of slugs) {
      expect(esGenre[slug], `es: ${slug}`).toBeTruthy();
      expect(enGenre[slug], `en: ${slug}`).toBeTruthy();
    }
  });
});
