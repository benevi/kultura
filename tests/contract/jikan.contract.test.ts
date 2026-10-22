/**
 * Contrato — Jikan v4 (MyAnimeList). Sin clave. Solo resuelve ids antiguos de
 * bibliotecas (anime y manga guardados cuando venían de MAL).
 * Llama a los clientes reales con `PROVIDER_CONTRACT_MODE=enforce`.
 */
import { describe, it, expect } from "vitest";
import { expectFieldCoverage, pause } from "./helpers";
import { getAnime, getAnimeVideos, getManga } from "@/lib/api/jikan";

describe("Jikan", () => {
  it("ficha de anime: cumple el contrato", async () => {
    const { data } = await getAnime(20); // Naruto
    expect(data.mal_id).toBe(20);
    expectFieldCoverage([data], ["title", "images.jpg.image_url", "synopsis", "genres"], 1);
  });

  it("vídeos de anime: cumple el contrato", async () => {
    await pause(1200); // Jikan: 3 peticiones/s
    const res = await getAnimeVideos(20);
    expect(res.data).toBeTypeOf("object");
  });

  it("ficha de manga: cumple el contrato", async () => {
    await pause(1200);
    const { data } = await getManga(13); // One Piece
    expect(data.mal_id).toBe(13);
  });
});
