/**
 * Contrato — Open Library (catálogo de libros). Sin clave.
 * Llama a los clientes reales con `PROVIDER_CONTRACT_MODE=enforce`.
 */
import { describe, it, expect } from "vitest";
import { expectFieldCoverage, pause } from "./helpers";
import {
  getBookDetail,
  OPEN_LIBRARY_CATALOG_WINDOW,
  searchOpenLibrary,
  probeOpenLibrary,
} from "@/lib/api/openlibrary";

describe("Open Library", () => {
  it("ventana del catálogo: cumple el contrato en menos de 6 s", async () => {
    const res = await searchOpenLibrary(
      'subject:"fiction"',
      1,
      { sort: "rating" },
      OPEN_LIBRARY_CATALOG_WINDOW
    );
    expect(res.docs.length).toBeGreaterThan(0);
    expect(typeof res.numFound).toBe("number");
    expectFieldCoverage(res.docs, ["title", "author_name", "first_publish_year", "cover_i"]);
  });

  it("ficha (search por key + /works): cumple el contrato", async () => {
    await pause(500);
    const detail = await getBookDetail("OL893414W"); // Dune
    expect(detail?.doc.key).toBe("/works/OL893414W");
  });

  it("sonda de /api/health?deep=1", async () => {
    await pause(500);
    await expect(probeOpenLibrary()).resolves.toBeUndefined();
  });
});
