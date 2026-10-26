// KULTURA — Wikidata (F-29) es un proveedor más de `PROVIDER_IDS`: su
// circuito y sus avisos van con su nombre sin forzar el tipo.

import { describe, it, expect } from "vitest";
import { PROVIDER_IDS } from "@/lib/api/http";
import { WIKIDATA_PROVIDER } from "@/lib/api/wikidata";

describe("PROVIDER_IDS", () => {
  it("incluye wikidata y es el id que usa su cliente", () => {
    expect(PROVIDER_IDS).toContain("wikidata");
    expect(WIKIDATA_PROVIDER).toBe("wikidata");
  });

  it("no tiene duplicados", () => {
    expect(new Set(PROVIDER_IDS).size).toBe(PROVIDER_IDS.length);
  });
});
