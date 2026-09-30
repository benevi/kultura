// ============================================================
// KULTURA — Puerta de editoriales del catálogo de cómic (E-COMIC-ALLOWLIST)
//
// Lo que se protege aquí es la FORMA de la decisión, no el contenido de las
// listas: la puerta tiene que denegar por defecto. Con dos listas negras, una
// editorial no enumerada pasaba, y así llegó hentai explícito a la página 100
// de Descubrir → Cómics. Un nombre inventado que no está en ninguna lista es
// por tanto el caso que de verdad importa.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  acceptsComicPublisher,
  isAllowedComicPublisher,
  isMangaPublisher,
  isAdultPublisher,
  COMIC_PUBLISHERS,
} from "@/lib/api/comic-publishers";

describe("acceptsComicPublisher (por defecto DENIEGA)", () => {
  // La regresión: antes esto pasaba, porque ninguna lista negra lo nombraba.
  it("una editorial desconocida NO entra, aunque no esté en ninguna lista negra", () => {
    expect(acceptsComicPublisher("Editorial Que No Existe")).toBe(false);
    expect(acceptsComicPublisher("Shinyusha")).toBe(false);
    expect(acceptsComicPublisher("Some Random Doujin Circle")).toBe(false);
  });

  it("deja pasar el catálogo que el usuario espera ver", () => {
    for (const name of [
      "DC Comics",
      "Marvel Comics",
      "Image Comics",
      "Dark Horse Comics",
      "IDW Publishing",
      "BOOM! Studios",
      "Dargaud",
      "Norma Editorial",
      "Sergio Bonelli Editore",
      "2000 AD",
      "Fantagraphics Books",
    ]) {
      expect(acceptsComicPublisher(name), name).toBe(true);
    }
  });

  // El veto no es redundante con la lista blanca: resuelve los sellos que
  // heredan el nombre de una editorial permitida.
  it("el sello de manga cae aunque su nombre contenga una editorial permitida", () => {
    expect(isAllowedComicPublisher("Dark Horse Manga")).toBe(true);
    expect(acceptsComicPublisher("Dark Horse Manga")).toBe(false);
    expect(acceptsComicPublisher("Glénat Manga")).toBe(false);
    expect(acceptsComicPublisher("Panini Manga")).toBe(false);
  });

  it("el sello adulto cae aunque su nombre contenga una editorial permitida", () => {
    expect(isAllowedComicPublisher("Fantagraphics Eros")).toBe(true);
    expect(acceptsComicPublisher("Fantagraphics Eros")).toBe(false);
  });

  it("el caso que se vio en pantalla: ANGEL Club MEGA", () => {
    expect(acceptsComicPublisher("Angel Club")).toBe(false);
    expect(isAdultPublisher("Angel Club")).toBe(true);
  });

  it("sin publisher no hay catálogo", () => {
    expect(acceptsComicPublisher("")).toBe(false);
  });
});

describe("matching por palabras completas, no por substring", () => {
  // Con substring crudo, la entrada "DC" casa con "Hardcover" ("har-DC-over").
  // Es el falso positivo que abriría la lista blanca de par en par.
  it('"DC" no cuela una editorial que solo contiene esas letras', () => {
    expect(isAllowedComicPublisher("Hardcover Editions")).toBe(false);
    expect(isAllowedComicPublisher("Verdcover")).toBe(false);
    expect(isAllowedComicPublisher("DC Comics")).toBe(true);
  });

  it("una entrada cubre los sellos de la misma casa sin enumerarlos", () => {
    expect(isAllowedComicPublisher("Marvel UK")).toBe(true);
    expect(isAllowedComicPublisher("Marvel Knights")).toBe(true);
  });

  it("la puntuación y los acentos no cambian la decisión", () => {
    expect(isAllowedComicPublisher("BOOM! Studios")).toBe(true);
    expect(isAllowedComicPublisher("Boom Studios")).toBe(true);
    expect(isAllowedComicPublisher("Glénat")).toBe(true);
    expect(isAllowedComicPublisher("Glenat")).toBe(true);
    expect(isAllowedComicPublisher("Les Humanoïdes Associés")).toBe(true);
  });

  it("es case-insensitive, como las listas que sustituye", () => {
    expect(isAllowedComicPublisher("dc comics")).toBe(true);
    expect(isMangaPublisher("SHUEISHA")).toBe(true);
    expect(isAdultPublisher("eros comix")).toBe(true);
  });
});

describe("coherencia de las listas", () => {
  // Una entrada de la lista blanca que ella misma dispare el veto sería una
  // editorial imposible de mostrar: entra por la puerta y la tumba el veto.
  it("ninguna entrada de la lista blanca está vetada por sí misma", () => {
    for (const name of COMIC_PUBLISHERS) {
      expect(acceptsComicPublisher(name), name).toBe(true);
    }
  });
});
