/**
 * Contrato — RAWG (videojuegos).
 * Llama a los clientes reales con `PROVIDER_CONTRACT_MODE=enforce`.
 * Requiere RAWG_API_KEY. Cada ejecución gasta 4 peticiones del cupo mensual.
 */
import { it, expect } from "vitest";
import { describeWithKeys, expectFieldCoverage } from "./helpers";
import { getGame, getPopularGames, searchGames, probeRawg } from "@/lib/api/rawg";

const GOD_OF_WAR = 3498; // id estable en RAWG

describeWithKeys(["RAWG_API_KEY"], "RAWG", () => {
  it("búsqueda: cumple el contrato y trae los campos que pinta la card", async () => {
    const res = await searchGames("the witcher");
    expect(res.results.length).toBeGreaterThan(0);
    expectFieldCoverage(res.results, [
      "background_image",
      "released",
      "rating",
      "ratings_count",
      "genres",
    ]);
  });

  it("catálogo (los rankings filtran por valoraciones y Metacritic)", async () => {
    const res = await getPopularGames(1);
    expectFieldCoverage(res.results, ["ratings_count", "metacritic", "tags"], 0.8);
  });

  it("ficha: cumple el contrato y trae lo que usa la ficha (incluido el enlace a Steam)", async () => {
    const game = await getGame(GOD_OF_WAR);
    expect(game.id).toBe(GOD_OF_WAR);
    expectFieldCoverage([game], ["description_raw", "developers", "stores"], 1);
  });

  it("sonda de /api/health?deep=1", async () => {
    await expect(probeRawg()).resolves.toBeUndefined();
  });
});
