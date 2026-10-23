// ============================================================
// F-15 · SEO de la ficha pública: indexación, descripción, JSON-LD (SEO-1/2)
// ============================================================

import { describe, it, expect } from "vitest";
import type { MediaItem, MediaType } from "@/types/media";
import {
  SCHEMA_TYPE,
  buildMediaJsonLd,
  isIndexable,
  mediaPath,
  metaDescription,
  serializeJsonLd,
} from "@/lib/media/seo";

const movie: MediaItem = {
  id: "movie_550",
  externalId: "550",
  type: "movie",
  title: "El club de la lucha",
  originalTitle: "Fight Club",
  poster: "https://image.tmdb.org/t/p/w500/p.jpg",
  year: 1999,
  synopsis: "Un oficinista insomne y un vendedor de jabón fundan un club clandestino.",
  genres: ["Drama"],
  rating: 8.4,
  ratingSource: "TMDB",
  metadata: { runtime: 139, director: "David Fincher", cast: ["Brad Pitt", "Edward Norton"] },
};

const URL_ES = "https://kulturaapp.vercel.app/es/media/movie/550";
const crumbs = [
  { name: "Inicio", url: "https://kulturaapp.vercel.app/es" },
  { name: "El club de la lucha", url: URL_ES },
];

function graph(item: MediaItem, extra: Partial<Parameters<typeof buildMediaJsonLd>[0]> = {}) {
  const ld = buildMediaJsonLd({
    item,
    genreLabels: ["Drama"],
    url: URL_ES,
    locale: "es",
    breadcrumbs: crumbs,
    ...extra,
  }) as { "@context": string; "@graph": Record<string, unknown>[] };
  return { ld, work: ld["@graph"][0], breadcrumb: ld["@graph"][1] };
}

describe("isIndexable", () => {
  it("con portada y sinopsis se indexa", () => {
    expect(isIndexable(movie, false)).toBe(true);
  });
  it("adulto (nsfw-filter) → noindex aunque tenga todo", () => {
    expect(isIndexable(movie, true)).toBe(false);
  });
  it.each([
    ["sin portada", { ...movie, poster: undefined }],
    ["sin sinopsis", { ...movie, synopsis: undefined }],
    ["sinopsis en blanco", { ...movie, synopsis: "   " }],
  ])("%s → noindex (contenido fino)", (_label, item) => {
    expect(isIndexable(item, false)).toBe(false);
  });
});

describe("metaDescription", () => {
  it("deja un texto corto tal cual y limpia espacios", () => {
    expect(metaDescription("  Hola\n\n  mundo  ")).toBe("Hola mundo");
  });
  it("corta en una palabra, sin pasar de max y con puntos suspensivos", () => {
    const long = "palabra ".repeat(40);
    const out = metaDescription(long, 155)!;
    expect(out.length).toBeLessThanOrEqual(155);
    expect(out.endsWith("palabra…")).toBe(true);
  });
  it("vacío → undefined (la página pone su texto de respaldo)", () => {
    expect(metaDescription("")).toBeUndefined();
    expect(metaDescription(undefined)).toBeUndefined();
  });
});

describe("mediaPath", () => {
  it("ruta con idioma e id escapado", () => {
    expect(mediaPath("en", "anime", "al-1535")).toBe("/en/media/anime/al-1535");
    expect(mediaPath("es", "book", "a b")).toBe("/es/media/book/a%20b");
  });
});

describe("buildMediaJsonLd", () => {
  it("una película: Movie con nombre, imagen, URL, año, director y reparto", () => {
    const { ld, work } = graph(movie);
    expect(ld["@context"]).toBe("https://schema.org");
    expect(work).toMatchObject({
      "@type": "Movie",
      name: "El club de la lucha",
      alternateName: "Fight Club",
      url: URL_ES,
      image: movie.poster,
      datePublished: "1999",
      genre: "Drama",
      duration: "PT139M",
      director: { "@type": "Person", name: "David Fincher" },
    });
    expect(work.actor).toHaveLength(2);
  });

  // VERIF-C y revisión del PR #40: ninguna nota se marca (ni la del
  // proveedor ni la de KULTURA), en ninguna familia.
  it.each(["movie", "tv", "anime", "game", "book", "manga", "comic"] as const)(
    "%s: sin aggregateRating ni la nota del proveedor",
    (type) => {
      const { ld } = graph({ ...movie, type });
      expect(JSON.stringify(ld)).not.toContain("aggregateRating");
      expect(JSON.stringify(ld)).not.toContain("8.4");
    }
  );

  it("BreadcrumbList con posiciones y URL absolutas", () => {
    const { breadcrumb } = graph(movie);
    expect(breadcrumb["@type"]).toBe("BreadcrumbList");
    expect(breadcrumb.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Inicio", item: "https://kulturaapp.vercel.app/es" },
      { "@type": "ListItem", position: 2, name: "El club de la lucha", item: URL_ES },
    ]);
  });

  it.each<[MediaType, string]>([
    ["movie", "Movie"],
    ["tv", "TVSeries"],
    ["anime", "TVSeries"],
    ["game", "VideoGame"],
    ["book", "Book"],
    ["manga", "ComicSeries"],
    ["comic", "ComicIssue"],
  ])("%s → @type %s", (type, schemaType) => {
    expect(SCHEMA_TYPE[type]).toBe(schemaType);
    expect(graph({ ...movie, type, metadata: {} }).work["@type"]).toBe(schemaType);
  });

  it("un juego lleva plataformas, desarrolladora y el enlace a su página de RAWG", () => {
    const game: MediaItem = {
      id: "game_3498",
      externalId: "3498",
      type: "game",
      title: "GTA V",
      year: 2013,
      metadata: { platforms: ["PC", "PlayStation 5"], developers: ["Rockstar North"], publishers: [] },
    };
    const { work } = graph(game, { sameAs: "https://rawg.io/games/grand-theft-auto-v" });
    expect(work).toMatchObject({
      "@type": "VideoGame",
      gamePlatform: ["PC", "PlayStation 5"],
      author: { "@type": "Organization", name: "Rockstar North" },
      sameAs: "https://rawg.io/games/grand-theft-auto-v",
    });
    expect(work.publisher).toBeUndefined();
  });

  it("no publica claves vacías ni la sinopsis traducida si no llega", () => {
    const bare: MediaItem = { id: "book_OL1W", externalId: "OL1W", type: "book", title: "Libro" };
    const { work } = graph(bare);
    expect(Object.keys(work).sort()).toEqual(["@id", "@type", "genre", "name", "url"].sort());
  });

  it("la descripción usa la sinopsis traducida cuando la hay", () => {
    expect(graph(movie, { description: "Translated text" }).work.description).toBe("Translated text");
  });
});

describe("serializeJsonLd", () => {
  it("no deja cerrar la etiqueta <script> desde un texto del proveedor", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script>");
  });
});
