import { describe, it, expect } from "vitest";
import {
  cleanSynopsis,
  isCjkOnly,
  isJapaneseAnimation,
  meetsMinRating,
  titleKey,
} from "@/lib/best/quality";
import type { MediaItem } from "@/types/media";

const tv = (over: Partial<MediaItem>): MediaItem => ({
  id: "tv_1",
  externalId: "1",
  type: "tv",
  title: "x",
  ...over,
});

describe("quality — titleKey", () => {
  it("iguala romanos, mayúsculas, acentos y signos", () => {
    expect(titleKey("HELLDIVERS 2")).toBe(titleKey("Helldivers II"));
    expect(titleKey("Pokémon: Leyendas")).toBe(titleKey("pokemon leyendas"));
    expect(titleKey("Final Fantasy VII Rebirth")).toBe(titleKey("final fantasy 7 rebirth"));
  });

  it("no toca palabras que empiezan el título ni distingue obras distintas", () => {
    expect(titleKey("V for Vendetta")).not.toBe(titleKey("5 for Vendetta"));
    expect(titleKey("Hades II")).not.toBe(titleKey("Hades"));
  });
});

describe("quality — isCjkOnly", () => {
  it("solo japonés/chino/coreano sin letras latinas", () => {
    expect(isCjkOnly("銀河特急 ミルキー☆サブウェイ")).toBe(true);
    expect(isCjkOnly("오징어 게임")).toBe(true);
    expect(isCjkOnly("Re:ゼロ")).toBe(false);
    expect(isCjkOnly("Frieren")).toBe(false);
    expect(isCjkOnly(undefined)).toBe(false);
  });
});

describe("quality — isJapaneseAnimation", () => {
  it("animación + origen JP o idioma ja", () => {
    expect(isJapaneseAnimation(tv({ genres: ["Animación"], metadata: { originCountry: ["JP"] } }))).toBe(true);
    expect(isJapaneseAnimation(tv({ genres: ["Animation"], metadata: { originalLanguage: "ja" } }))).toBe(true);
    expect(isJapaneseAnimation(tv({ genres: ["Animation"], metadata: { originCountry: ["US"] } }))).toBe(false);
    expect(isJapaneseAnimation(tv({ genres: ["Drama"], metadata: { originCountry: ["JP"] } }))).toBe(false);
    expect(isJapaneseAnimation(tv({ genres: ["Animación"] }))).toBe(false);
  });
});

describe("quality — meetsMinRating", () => {
  it("7,0 entra; 6,9 y sin nota, no", () => {
    expect(meetsMinRating(tv({ rating: 7 }))).toBe(true);
    expect(meetsMinRating(tv({ rating: 6.9 }))).toBe(false);
    expect(meetsMinRating(tv({}))).toBe(false);
  });
});

describe("quality — cleanSynopsis", () => {
  it("quita HTML y las coletillas de fuente de AniList/MAL", () => {
    expect(
      cleanSynopsis("The battle at Priestella continues.<br><br>(Source: Crunchyroll)<br><br>Note: Episode 1 aired early.")
    ).toBe("The battle at Priestella continues.");
    expect(cleanSynopsis("A story. (Source: MAL News)")).toBe("A story.");
    expect(cleanSynopsis("A story.\n\n[Written by MAL Rewrite]")).toBe("A story.");
  });

  it("corta en el último punto antes del límite", () => {
    const long = `${"Primera frase bastante larga para el ejemplo. ".repeat(12)}Fin`;
    const out = cleanSynopsis(long, 200)!;
    expect(out.length).toBeLessThanOrEqual(200);
    expect(out.endsWith(".")).toBe(true);
  });

  it("vacío → undefined", () => {
    expect(cleanSynopsis("")).toBeUndefined();
    expect(cleanSynopsis("(Source: X)")).toBeUndefined();
    expect(cleanSynopsis(null)).toBeUndefined();
  });
});
