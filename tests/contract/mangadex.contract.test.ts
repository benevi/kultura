/**
 * Contrato — MangaDex (manga). Sin clave.
 * Llama a los clientes reales con `PROVIDER_CONTRACT_MODE=enforce`.
 */
import { describe, it, expect } from "vitest";
import { expectFieldCoverage, pause } from "./helpers";
import {
  extractMangaCover,
  getManga,
  getPopularManga,
  searchManga,
  probeMangaDex,
} from "@/lib/api/mangadex";

describe("MangaDex", () => {
  it("catálogo (idioma activo + seguidores): cumple el contrato", async () => {
    const res = await getPopularManga(0, "es");
    expect(res.data.length).toBeGreaterThan(0);
    expectFieldCoverage(res.data, [
      "attributes.title",
      "attributes.description",
      "attributes.year",
      "attributes.status",
      "attributes.tags",
    ]);
    // La portada sale de `relationships` (`includes[]=cover_art`).
    expect(res.data.filter((m) => extractMangaCover(m)).length).toBeGreaterThan(0);
  });

  it("búsqueda y ficha: cumplen el contrato", async () => {
    await pause(500);
    const res = await searchManga("one piece", 0, "es");
    const first = res.data[0];
    expect(first).toBeDefined();
    await pause(500);
    const detail = await getManga(first.id);
    expect(detail.data.id).toBe(first.id);
  });

  it("sonda de /api/health?deep=1", async () => {
    await pause(500);
    await expect(probeMangaDex()).resolves.toBeUndefined();
  });
});
