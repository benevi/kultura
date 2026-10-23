/**
 * Contrato — Google Books (ficha de libro). Requiere GOOGLE_BOOKS_KEY: sin
 * clave la cuota anónima por IP suele estar a 0 (429) y el test no diría nada
 * del contrato.
 * Llama a los clientes reales con `PROVIDER_CONTRACT_MODE=enforce`.
 */
import { it, expect } from "vitest";
import { describeWithKeys, expectFieldCoverage } from "./helpers";
import {
  getGoogleBookDetail,
  searchGoogleBooks,
  probeGoogleBooks,
} from "@/lib/api/googlebooks";

describeWithKeys(["GOOGLE_BOOKS_KEY"], "Google Books", () => {
  it("búsqueda por ISBN y ficha: cumplen el contrato", async () => {
    const res = await searchGoogleBooks("isbn:9780441013593", 1, {}, "en");
    const first = res.items?.[0];
    expect(first).toBeDefined();
    expectFieldCoverage([first], ["volumeInfo.title", "volumeInfo.imageLinks"], 1);
    const detail = await getGoogleBookDetail(first!.id);
    expect(detail?.id).toBe(first!.id);
  });

  it("sonda de /api/health?deep=1", async () => {
    await expect(probeGoogleBooks()).resolves.toBeUndefined();
  });
});
