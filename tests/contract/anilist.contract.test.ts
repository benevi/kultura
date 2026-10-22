/**
 * Contrato — AniList (anime). Sin clave.
 * Llama a los clientes reales con `PROVIDER_CONTRACT_MODE=enforce`.
 */
import { describe, it, expect } from "vitest";
import { expectFieldCoverage, pause } from "./helpers";
import { discoverAnime, getAnime, searchAnime, probeAniList } from "@/lib/api/anilist";

describe("AniList", () => {
  it("catálogo: cumple el contrato y trae los campos que pinta la card", async () => {
    const page = await discoverAnime(1, { sort: ["POPULARITY_DESC"] });
    expect(page.media.length).toBeGreaterThan(0);
    expect(typeof page.pageInfo.hasNextPage).toBe("boolean");
    expectFieldCoverage(page.media, [
      "title.romaji",
      "title.english",
      "coverImage.large",
      "genres",
      "averageScore",
      "seasonYear",
      "status",
    ]);
  });

  it("búsqueda: cumple el contrato", async () => {
    await pause(1000);
    const page = await searchAnime("cowboy bebop", 1);
    expect(page.media.some((m) => m.id === 1)).toBe(true);
  });

  it("ficha: cumple el contrato", async () => {
    await pause(1000);
    const media = await getAnime(1);
    expect(media.id).toBe(1);
    expectFieldCoverage([media], ["description", "episodes", "studios.nodes"], 1);
  });

  it("sonda de /api/health?deep=1", async () => {
    await pause(1000);
    await expect(probeAniList()).resolves.toBeUndefined();
  });
});
