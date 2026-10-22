// ============================================================
// KULTURA — Utilidades de los tests de contrato (COD-7)
//
// Los tests de contrato llaman a los clientes REALES (`src/lib/api/*`) contra
// las APIs reales, con `PROVIDER_CONTRACT_MODE=enforce` (lo fija
// `vitest.contract.config.ts`). Así validan exactamente los esquemas que usa
// producción: si un proveedor cambia la forma, aquí salta
// `ProviderContractError` con la lista de campos.
//
// Además comprueban la COBERTURA de los campos que la app lee aunque el
// esquema los deje opcionales (para no tumbar producción): si `metacritic`
// desaparece de los listados de RAWG, producción sigue sirviendo, pero el
// contrato semanal lo avisa con un issue.
// ============================================================

import { describe, expect, it } from "vitest";

/** `tests/setup.ts` pone claves de relleno `test-…`: esas no cuentan como reales. */
export function realKey(name: string): boolean {
  const v = process.env[name];
  return Boolean(v && !v.startsWith("test-"));
}

/**
 * `describe` que necesita claves. Sin ellas se salta en local, pero en el
 * workflow (`CONTRACT_REQUIRE_KEYS=1`) falla: un secreto que falta no puede
 * convertirse en un contrato "verde".
 */
export function describeWithKeys(keys: string[], name: string, fn: () => void): void {
  const missing = keys.filter((k) => !realKey(k));
  if (missing.length === 0) {
    describe(name, fn);
    return;
  }
  if (process.env.CONTRACT_REQUIRE_KEYS === "1") {
    describe(name, () => {
      it(`faltan secretos: ${missing.join(", ")}`, () => {
        throw new Error(`Faltan secretos para el contrato: ${missing.join(", ")}`);
      });
    });
    return;
  }
  describe.skip(`${name} (sin ${missing.join(", ")})`, fn);
}

/**
 * Al menos `minRatio` de los elementos traen el campo (aunque sea `null`).
 * Un campo que deja de llegar en TODOS es un cambio de contrato.
 */
export function expectFieldCoverage(
  items: unknown[],
  fields: string[],
  minRatio = 0.5
): void {
  expect(items.length).toBeGreaterThan(0);
  for (const field of fields) {
    const withField = items.filter((it) => {
      let cur: unknown = it;
      for (const part of field.split(".")) {
        if (cur === null || typeof cur !== "object" || !(part in cur)) return false;
        cur = (cur as Record<string, unknown>)[part];
      }
      return true;
    }).length;
    expect(
      withField / items.length,
      `el campo "${field}" llega en ${withField}/${items.length} elementos`
    ).toBeGreaterThanOrEqual(minRatio);
  }
}

/** Pausa entre llamadas para respetar los límites por segundo (Jikan, AniList). */
export const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
