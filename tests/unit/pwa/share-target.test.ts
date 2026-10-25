/**
 * MOV-9 — `share_target`: lo que otra app comparte con KULTURA abre la
 * búsqueda con el título más limpio posible.
 */
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { MAX_QUERY_LENGTH, cleanTitle, shareQuery } from "@/components/pwa/share-target";
import { GET } from "@/app/[locale]/share/route";

describe("shareQuery", () => {
  it.each([
    ["https://www.themoviedb.org/movie/693134-dune-part-two?language=es", "dune part two"],
    ["https://www.themoviedb.org/tv/1399-game-of-thrones", "game of thrones"],
    ["https://letterboxd.com/film/past-lives/", "past lives"],
    ["https://myanimelist.net/anime/5114/Fullmetal_Alchemist__Brotherhood", "Fullmetal Alchemist Brotherhood"],
    ["https://anilist.co/manga/30013/One-Piece/", "One Piece"],
    ["https://www.goodreads.com/book/show/44767458-dune", "dune"],
    ["https://rawg.io/games/elden-ring", "elden ring"],
    ["https://store.steampowered.com/app/1245620/ELDEN_RING/", "ELDEN RING"],
    ["https://www.themoviedb.org/movie/550-el-club-de-la-lucha", "el club de la lucha"],
  ])("ficha conocida %s → %s", (url, expected) => {
    expect(shareQuery({ url, title: "Ignorado | Sitio" })).toBe(expected);
  });

  it("la URL puede venir dentro del texto (Android a menudo no rellena `url`)", () => {
    expect(shareQuery({ text: "Mira esta: https://letterboxd.com/film/aftersun/ 🔥" })).toBe("aftersun");
  });

  it("sin ficha conocida: el título sin el sufijo del sitio", () => {
    expect(
      shareQuery({ title: "Dune: Parte dos (2024) | The Movie Database (TMDB)", url: "https://www.imdb.com/title/tt15239678/" }),
    ).toBe("Dune: Parte dos (2024)");
    expect(cleanTitle("Oppenheimer - Wikipedia, la enciclopedia libre")).toBe("Oppenheimer");
    expect(cleanTitle("Frieren · AniList")).toBe("Frieren");
  });

  it("no se come un subtítulo con guion que no es un sitio", () => {
    expect(cleanTitle("Spider-Man - Cruzando el Multiverso")).toBe("Spider-Man - Cruzando el Multiverso");
    expect(cleanTitle("Mad Max - Max Payne")).toBe("Mad Max - Max Payne");
  });

  it("sin título: el texto sin enlaces", () => {
    expect(shareQuery({ text: "The Bear https://example.com/x" })).toBe("The Bear");
  });

  it("nada aprovechable → vacío; textos enormes se recortan", () => {
    expect(shareQuery({})).toBe("");
    expect(shareQuery({ url: "javascript:alert(1)" })).toBe("");
    expect(shareQuery({ text: "https://example.com/" })).toBe("");
    expect(Array.from(shareQuery({ title: "á".repeat(500) }))).toHaveLength(MAX_QUERY_LENGTH);
  });

  it("escapes rotos en la ruta no rompen", () => {
    expect(shareQuery({ url: "https://letterboxd.com/film/%E0%A4%A/" })).toBe("%E0%A4%A");
  });
});

describe("GET /[locale]/share", () => {
  const call = (locale: string, query: string) =>
    GET(new Request(`https://kulturaapp.vercel.app/${locale}/share?${query}`), {
      params: Promise.resolve({ locale }),
    });

  it("redirige (303) a la búsqueda del idioma con el título", async () => {
    const res = await call("en", new URLSearchParams({ url: "https://letterboxd.com/film/past-lives/" }).toString());
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://kulturaapp.vercel.app/en/search?q=past+lives");
  });

  it("sin nada útil, a Descubrir; idioma raro, el por defecto", async () => {
    const res = await call("xx", "title=&text=");
    expect(res.headers.get("location")).toBe("https://kulturaapp.vercel.app/es/discover");
  });

  it("nunca redirige fuera de la web aunque compartan una URL ajena", async () => {
    const res = await call("es", new URLSearchParams({ url: "https://evil.example/", title: "//evil.example" }).toString());
    expect(new URL(res.headers.get("location")!).origin).toBe("https://kulturaapp.vercel.app");
  });
});
