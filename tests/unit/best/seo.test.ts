import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T) => fn }));

import { bestMetadata, rankingJsonLd, serializeJsonLd, hubJsonLd } from "@/lib/best/seo";
import { bestPosterLoader } from "@/lib/best/poster";
import { saveHref, signUpHref } from "@/lib/best/links";
import { bestItemPath, type BestItem } from "@/lib/best/best-of";

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://x.app"));
afterEach(() => vi.unstubAllEnvs());

const items: BestItem[] = [
  { id: "anime_al-1", externalId: "al-1", type: "anime", title: "Frieren", poster: "https://s4.anilist.co/a.png", genres: [] },
  { id: "movie_550", type: "movie", title: "El club de la lucha", poster: "https://image.tmdb.org/t/p/w500/b.jpg", genres: [] },
];
const crumbs = [
  { name: "Inicio", path: "/" },
  { name: "Rankings", path: "/best" },
  { name: "Animes", path: "/best/anime" },
  { name: "2026", path: "/best/anime/2026" },
];

describe("JSON-LD de un ranking (SEO-2, SEO-10)", () => {
  const build = () => rankingJsonLd({
    locale: "es",
    path: "/best/anime/2026",
    title: "Los mejores animes de 2026",
    description: "d",
    updatedAt: "2026-10-22T05:00:00.000Z",
    items,
    crumbs,
  });

  it("cada ListItem lleva url a su ficha pública e image", () => {
    const page = build()["@graph"][0];
    const list = page.mainEntity.itemListElement;
    expect(list[0]).toMatchObject({
      "@type": "ListItem",
      position: 1,
      name: "Frieren",
      url: "https://x.app/es/media/anime/al-1",
      image: "https://s4.anilist.co/a.png",
    });
    // Entradas antiguas de la caché sin externalId: se saca del id.
    expect(list[1].url).toBe("https://x.app/es/media/movie/550");
  });

  it("migas como BreadcrumbList y fecha real de actualización; sin aggregateRating", () => {
    const ld = build();
    const page = ld["@graph"][0];
    expect(page.breadcrumb["@type"]).toBe("BreadcrumbList");
    expect(page.breadcrumb.itemListElement.map((c: { item: string }) => c.item)).toEqual([
      "https://x.app/es",
      "https://x.app/es/best",
      "https://x.app/es/best/anime",
      "https://x.app/es/best/anime/2026",
    ]);
    expect(page.dateModified).toBe("2026-10-22T05:00:00.000Z");
    expect(JSON.stringify(ld)).not.toContain("aggregateRating");
  });

  it("no puede cerrar la etiqueta <script>", () => {
    expect(serializeJsonLd({ name: "</script><b>" })).not.toContain("<");
  });

  it("hub: enlaza a los rankings que agrupa", () => {
    const hub = hubJsonLd({ locale: "en", path: "/best", title: "t", description: "d", crumbs: crumbs.slice(0, 2), links: [{ name: "Anime", path: "/best/anime" }] });
    expect(hub["@graph"][0].mainEntity.itemListElement[0].url).toBe("https://x.app/en/best/anime");
  });
});

describe("metadatos de /best", () => {
  it("canonical, hreflang y og:url propios; og completo (Next no fusiona openGraph)", () => {
    const m = bestMetadata({ locale: "en", path: "/best/movie", title: "Best movies by year", description: "d" });
    expect(m.alternates?.canonical).toBe("https://x.app/en/best/movie");
    expect(m.alternates?.languages).toMatchObject({ es: "https://x.app/es/best/movie", "x-default": "https://x.app/es/best/movie" });
    expect(m.openGraph).toMatchObject({ siteName: "KULTURA", locale: "en_US", url: "https://x.app/en/best/movie" });
    expect(m.robots).toBeUndefined();
  });

  it("lista corta → noindex, follow", () => {
    const m = bestMetadata({ locale: "es", path: "/best/movie/2026", title: "t", description: "d", indexable: false });
    expect(m.robots).toEqual({ index: false, follow: true });
  });
});

describe("portadas de /best (D-10)", () => {
  it("AniList pasa por el optimizador en solo dos anchos", () => {
    const widths = [64, 128, 256, 384, 640, 750, 1080].map((width) =>
      bestPosterLoader({ src: "https://s4.anilist.co/file/cover/large/bx1.png", width }),
    );
    for (const url of widths) expect(url.startsWith("/_next/image?url=")).toBe(true);
    const ws = new Set(widths.map((u) => new URL(u, "https://x.app").searchParams.get("w")));
    expect(Array.from(ws).sort()).toEqual(["256", "640"]);
    expect(widths[0]).toContain("q=70");
  });

  it("TMDB y RAWG siguen yendo directos a su CDN al tamaño justo", () => {
    expect(bestPosterLoader({ src: "https://image.tmdb.org/t/p/original/a.jpg", width: 300 })).toBe(
      "https://image.tmdb.org/t/p/w342/a.jpg",
    );
    expect(bestPosterLoader({ src: "https://media.rawg.io/media/games/a.jpg", width: 300 })).toBe(
      "https://media.rawg.io/media/resize/420/-/games/a.jpg",
    );
  });
});

describe("enlaces de /best", () => {
  it("la ficha usa el id de MediaCard y Guardar lleva a ella", () => {
    expect(bestItemPath(items[0])).toBe("/media/anime/al-1");
    // Guardar lleva a la ficha (allí está el botón o el alta), nunca a /login.
    expect(saveHref("es", items[0])).toBe("/es/media/anime/al-1");
    expect(signUpHref("en", "/en/best")).toBe("/en/login?mode=register&next=%2Fen%2Fbest");
  });
});
