// ============================================================
// F-29 · De filas de Wikidata a títulos de KULTURA (PRO-11)
// ============================================================

// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  bindingToLink,
  isAdaptationLink,
  linkTitle,
  mapAdaptations,
  pickTarget,
  subjectQid,
} from "@/lib/adaptations/map";
import type { SparqlBinding } from "@/lib/api/wikidata";

const lit = (value: string) => ({ type: "literal", value });
const uri = (q: string) => ({ type: "uri", value: `http://www.wikidata.org/entity/${q}` });

function row(over: Record<string, string>, work = "Q1"): SparqlBinding {
  const out: SparqlBinding = { work: uri(work), subject_: uri("Q9"), rels_: lit("source"), labelEn_: lit("Title") };
  for (const [k, v] of Object.entries(over)) out[`${k}_`] = lit(v);
  return out;
}

describe("pickTarget: el id decide el formato", () => {
  it("anime antes que película (película de anime con TMDB y AniList)", () => {
    expect(pickTarget(row({ tmdbMovie: "129", alAnime: "199" }))).toEqual({ type: "anime", externalId: "al-199" });
  });
  it("AniList antes que MAL; MAL si no hay AniList (Jikan)", () => {
    expect(pickTarget(row({ alAnime: "1", malAnime: "2" }))).toEqual({ type: "anime", externalId: "al-1" });
    expect(pickTarget(row({ malAnime: "2" }))).toEqual({ type: "anime", externalId: "2" });
    expect(pickTarget(row({ alManga: "30013", ol: "OL1W" }))).toEqual({ type: "manga", externalId: "al-30013" });
    expect(pickTarget(row({ malManga: "13" }))).toEqual({ type: "manga", externalId: "13" });
  });
  it("película, serie, juego (slug), libro (obra OL…W) y cómic (número 4000-)", () => {
    expect(pickTarget(row({ tmdbMovie: "841" }))).toEqual({ type: "movie", externalId: "841" });
    expect(pickTarget(row({ tmdbTv: "19566" }))).toEqual({ type: "tv", externalId: "19566" });
    expect(pickTarget(row({ rawg: "Dune-II" }))).toEqual({ type: "game", externalId: "", rawgSlug: "dune-ii" });
    expect(pickTarget(row({ ol: "OL893461W" }))).toEqual({ type: "book", externalId: "OL893461W" });
    expect(pickTarget(row({ cv: "4000-6686" }))).toEqual({ type: "comic", externalId: "6686" });
  });
  it("ids con forma rara se ignoran", () => {
    expect(pickTarget(row({ tmdbMovie: "abc", ol: "OL1M", cv: "4050-1", rawg: "../etc" }))).toBeNull();
  });
});

describe("bindingToLink", () => {
  it("vínculo completo con etiquetas, año y relaciones ordenadas", () => {
    const link = bindingToLink({
      ...row({ ol: "OL893461W", date: "1965-01-01T00:00:00Z", rels: "franchise,source", labelEs: "Dune" }, "Q190192"),
      labelEn_: lit("Dune"),
    });
    expect(link).toEqual({
      mediaId: "book_OL893461W",
      type: "book",
      externalId: "OL893461W",
      qid: "Q190192",
      labels: { es: "Dune", en: "Dune" },
      year: 1965,
      relations: ["source", "franchise"],
    });
  });

  it("regresión: la etiqueta 'mul' hace de inglés (Wikidata quitó la 'en' de The Last of Us)", () => {
    const r = row({ rawg: "the-last-of-us", labelMul: "The Last of Us" });
    delete r.labelEn_;
    expect(bindingToLink(r)?.labels).toEqual({ en: "The Last of Us" });
  });

  it("sin nombre, sin relación o con un Q-id por título: fuera", () => {
    const sinNombre = row({ tmdbMovie: "1" });
    delete sinNombre.labelEn_;
    expect(bindingToLink(sinNombre)).toBeNull();
    expect(bindingToLink(row({ tmdbMovie: "1", rels: "otra" }))).toBeNull();
    expect(bindingToLink({ ...row({ tmdbMovie: "1" }), labelEn_: lit("Q12345") })).toBeNull();
  });

  it("los juegos sin número aún no tienen mediaId", () => {
    expect(bindingToLink(row({ rawg: "dune-ii" }))).toMatchObject({ mediaId: null, rawgSlug: "dune-ii", type: "game" });
  });
});

describe("mapAdaptations", () => {
  it("quita el propio título, junta repetidos y ordena por relación y año", () => {
    const links = mapAdaptations(
      [
        row({ tmdbMovie: "438631", rels: "sibling" }, "Q1"), // el propio título
        row({ tmdbMovie: "841", rels: "franchise", date: "1984-01-01T00:00:00Z" }, "Q2"),
        row({ tmdbMovie: "841", rels: "sibling", labelEs: "Dune (1984)" }, "Q3"), // mismo id, otro elemento
        row({ ol: "OL893461W", rels: "source", date: "1965-01-01T00:00:00Z" }, "Q4"),
        row({ tmdbMovie: "693134", rels: "franchise", date: "2024-01-01T00:00:00Z" }, "Q5"),
      ],
      "movie_438631"
    );
    expect(links.map((l) => [l.mediaId, l.relations])).toEqual([
      ["book_OL893461W", ["source"]],
      ["movie_841", ["sibling", "franchise"]],
      ["movie_693134", ["franchise"]],
    ]);
    expect(links[1].labels).toEqual({ en: "Title", es: "Dune (1984)" });
  });

  it("subjectQid y linkTitle", () => {
    expect(subjectQid([row({ tmdbMovie: "1" })])).toBe("Q9");
    expect(subjectQid([])).toBeNull();
    expect(linkTitle({ labels: { es: "El hobbit", en: "The Hobbit" } }, "es")).toBe("El hobbit");
    expect(linkTitle({ labels: { es: "El hobbit", en: "The Hobbit" } }, "en")).toBe("The Hobbit");
    expect(linkTitle({ labels: { en: "Frieren" } }, "es")).toBe("Frieren");
  });

  it("isAdaptationLink valida lo que se lee de la tabla", () => {
    const [link] = mapAdaptations([row({ tmdbMovie: "841" })], "movie_1");
    expect(isAdaptationLink(link)).toBe(true);
    expect(isAdaptationLink({ mediaId: 3 })).toBe(false);
    expect(isAdaptationLink(null)).toBe(false);
  });
});
