/**
 * Contrato — ComicVine (cómics).
 * Llama a los clientes reales con `PROVIDER_CONTRACT_MODE=enforce`; además el
 * cliente comprueba `status_code` (una clave inválida o el límite de peticiones
 * fallan aquí en vez de pasar por "sin resultados").
 * Requiere COMICVINE_KEY. Gasta 4 peticiones del cupo horario por recurso.
 */
import { it, expect } from "vitest";
import { describeWithKeys, expectFieldCoverage, pause } from "./helpers";
import {
  getComic,
  resolveVolumePublishers,
  searchComics,
  probeComicVine,
} from "@/lib/api/comicvine";

describeWithKeys(["COMICVINE_KEY"], "ComicVine", () => {
  it("búsqueda de issues: cumple el contrato y trae lo que pinta la card", async () => {
    const res = await searchComics("batman", 1);
    expect(res.results.length).toBeGreaterThan(0);
    expectFieldCoverage(res.results, ["image", "cover_date", "volume.id", "volume.name"]);
  });

  it("ficha de issue y editorial del volumen: cumplen el contrato", async () => {
    await pause(1100); // ComicVine bloquea ráfagas
    const res = await searchComics("watchmen", 1);
    const first = res.results[0];
    expect(first).toBeDefined();
    await pause(1100);
    const issue = await getComic(String(first.id));
    expect(issue.id).toBe(first.id);
    if (first.volume?.id) {
      await pause(1100);
      const publishers = await resolveVolumePublishers([first.volume.id]);
      expect(publishers.get(first.volume.id)).toBeTypeOf("string");
    }
  });

  it("sonda de /api/health?deep=1", async () => {
    await pause(1100);
    await expect(probeComicVine()).resolves.toBeUndefined();
  });
});
