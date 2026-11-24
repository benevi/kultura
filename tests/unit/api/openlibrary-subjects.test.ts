// ============================================================
// KULTURA — Subjects y descripción de Open Library (E-BOOKS-SUBJ)
//
// Los dos defectos que se ven en pantalla y que esto protege:
//   - TODOS los libros salían con 0% MATCH, porque de los subjects se cogían
//     los cinco primeros y esos suelen ser ruido de catalogación; al
//     canonizarlos no quedaba ningún género que puntuar.
//   - La ficha pintaba "Beaches" como género de una novela romántica, y en los
//     libros autopublicados un párrafo entero de palabras clave dentro de un
//     chip.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  pickBookSubjects,
  cleanOpenLibraryDescription,
} from "@/lib/api/openlibrary-subjects";
import { canonicalGenres } from "@/lib/recommendations/genre-canonical";

describe("pickBookSubjects", () => {
  // Caso real: "The Summer I Turned Pretty" traía "Beaches" delante y el
  // género de verdad detrás, así que el match no tenía con qué puntuar.
  it("pone delante los subjects que el match sabe puntuar", () => {
    const picked = pickBookSubjects([
      "Beaches",
      "Friendship",
      "Romance",
      "Summer",
      "Fiction",
      "Love",
    ]);

    expect(picked?.[0]).toBe("Romance");
    expect(canonicalGenres(picked).length).toBeGreaterThan(0);
  });

  it("descarta los metadatos de archivo de Open Library", () => {
    const picked = pickBookSubjects([
      "Accessible book",
      "Protected DAISY",
      "In library",
      "Fantasy",
    ]);

    expect(picked).toEqual(["Fantasy"]);
  });

  it("descarta las etiquetas de catálogo con prefijo", () => {
    const picked = pickBookSubjects(["nyt:bestseller=2011-01-01", "Horror"]);
    expect(picked).toEqual(["Horror"]);
  });

  // El libro autopublicado de la captura: toda la ficha de marketing metida en
  // un solo subject, que se pintaba entero dentro de un chip.
  it("descarta el volcado de palabras clave de los libros de relleno", () => {
    const spam =
      "THE FIVE CARIBBEAN FISHERMEN| THE FIVE CARIBBEAN FISHERMEN BY ROBERT " +
      "DIEUDELIN AUTHOR| BROTHERSWAGG| CARIBBEAN MYTHOLOGY| BOOKS";

    expect(pickBookSubjects([spam])).toBeUndefined();
  });

  it("sin ningún género reconocible no hay géneros (el campo se oculta)", () => {
    expect(pickBookSubjects(["Beaches", "Summer", "Friendship"])).toBeUndefined();
  });

  it("nunca devuelve más de cinco", () => {
    const many = [
      "Fiction", "Fantasy", "Horror", "Romance", "Poetry", "Humor", "Essays",
    ];
    expect(pickBookSubjects(many)).toHaveLength(5);
  });

  // Datos reales recortados de https://openlibrary.org/works/OL27448W.json
  // (El Señor de los Anillos). La ficha enseñaba «Géneros: Baggins, Frodo
  // (Fictitious character)».
  it("OL27448W: no cuela personajes, lugares ni temas como géneros", () => {
    const picked = pickBookSubjects([
      "The Lord of the Rings",
      "Fiction",
      "Ficción",
      "English Fantasy fiction",
      "Fantasy fiction",
      "Open Library Staff Picks",
      "Middle Earth (Imaginary place)",
      "Fiction, fantasy, epic",
      "Baggins, frodo (fictitious character), fiction",
      "Gandalf (fictitious character), fiction",
      "Frodo Baggins (Fictitious character)",
      "Fiction, fantasy, general",
      "Wizards",
      "Terre du Milieu (Lieu imaginaire)",
      "Baggins, frodo",
      "Middle earth (imaginary place)--fiction",
    ]);

    expect(picked).toBeDefined();
    expect(picked!.length).toBeGreaterThan(0);
    for (const genre of picked!) {
      expect(genre).not.toMatch(/fictitious|imaginary|imaginaire|baggins|wizards|lord of the rings/i);
      expect(canonicalGenres([genre]).length).toBeGreaterThan(0);
    }
  });

  it("descarta personajes y lugares aunque el resto no sea género", () => {
    expect(
      pickBookSubjects([
        "Baggins, Frodo (Fictitious character)",
        "Middle Earth (Imaginary place)",
        "Fiction, general",
      ])
    ).toBeUndefined();
  });

  it("no repite el mismo género", () => {
    expect(pickBookSubjects(["Fantasy", "fantasy", "Fantasy "])).toEqual(["Fantasy"]);
  });

  it("sin subjects devuelve undefined, no una lista vacía", () => {
    expect(pickBookSubjects(undefined)).toBeUndefined();
    expect(pickBookSubjects([])).toBeUndefined();
    expect(pickBookSubjects(["Accessible book"])).toBeUndefined();
  });
});

describe("cleanOpenLibraryDescription", () => {
  it("quita los escapes de Markdown que se ven crudos en la ficha", () => {
    const raw =
      "\\--- \\*\\*Title:\\*\\* The Five Caribbean Fishermen \\*\\*Author:\\*\\* Robert Dieudelin";

    const out = cleanOpenLibraryDescription(raw);

    expect(out).not.toContain("\\*");
    expect(out).toContain("Title:");
    expect(out?.startsWith("---")).toBe(false);
  });

  it("quita el énfasis de Markdown sin comerse el texto", () => {
    expect(cleanOpenLibraryDescription("Una **gran** novela")).toBe(
      "Una gran novela"
    );
  });

  it("quita el enlace de procedencia que Open Library añade al final", () => {
    const out = cleanOpenLibraryDescription("Una novela. ([source][2])");
    expect(out).toBe("Una novela.");
  });

  it("deja intacta una sinopsis normal", () => {
    const normal =
      "Belly siempre ha vivido para el verano, porque el verano significa " +
      "todas sus cosas favoritas.";
    expect(cleanOpenLibraryDescription(normal)).toBe(normal);
  });

  it("sin descripción devuelve undefined", () => {
    expect(cleanOpenLibraryDescription(undefined)).toBeUndefined();
    expect(cleanOpenLibraryDescription("   ")).toBeUndefined();
  });
});
