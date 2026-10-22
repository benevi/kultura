import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
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

  it("es solo de servidor: ningún archivo 'use client' lo importa (ni los rankings)", () => {
    const root = path.resolve(__dirname, "../../../src");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
          const src = fs.readFileSync(full, "utf8");
          const isClient = /^\s*["']use client["']/.test(src);
          if (isClient && /@\/lib\/(api\/genre-label-maps|best\/(localize|best-of))["']/.test(src)) {
            offenders.push(path.relative(root, full));
          }
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
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
