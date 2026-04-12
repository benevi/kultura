/**
 * Tests de paridad i18n.
 * Verifica que es.json y en.json tienen exactamente las mismas claves
 * en todos los niveles del árbol. Si falta una clave en algún idioma,
 * el test falla con un mensaje descriptivo de qué clave falta.
 */
import { describe, it, expect } from "vitest";
import es from "../../../messages/es.json";
import en from "../../../messages/en.json";

type Messages = Record<string, unknown>;

/**
 * Extrae todas las rutas de claves de un objeto anidado.
 * Ejemplo: { a: { b: "val" } } → ["a.b"]
 */
function extractKeys(obj: Messages, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return extractKeys(value as Messages, fullKey);
    }
    return [fullKey];
  });
}

describe("i18n — paridad de claves entre locales", () => {
  const esKeys = extractKeys(es).sort();
  const enKeys = extractKeys(en).sort();

  it("es.json y en.json tienen el mismo número de claves", () => {
    expect(esKeys.length).toBe(enKeys.length);
  });

  it("todas las claves de es.json existen en en.json", () => {
    const missingInEn = esKeys.filter((k) => !enKeys.includes(k));
    expect(missingInEn).toEqual([]);
  });

  it("todas las claves de en.json existen en es.json", () => {
    const missingInEs = enKeys.filter((k) => !esKeys.includes(k));
    expect(missingInEs).toEqual([]);
  });

  it("ningún valor es string vacío en es.json", () => {
    function findEmpty(obj: Messages, prefix = ""): string[] {
      return Object.entries(obj).flatMap(([key, value]) => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === "object" && value !== null) {
          return findEmpty(value as Messages, fullKey);
        }
        if (value === "") return [fullKey];
        return [];
      });
    }
    const emptyKeys = findEmpty(es);
    expect(emptyKeys).toEqual([]);
  });

  it("ningún valor es string vacío en en.json", () => {
    function findEmpty(obj: Messages, prefix = ""): string[] {
      return Object.entries(obj).flatMap(([key, value]) => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === "object" && value !== null) {
          return findEmpty(value as Messages, fullKey);
        }
        if (value === "") return [fullKey];
        return [];
      });
    }
    const emptyKeys = findEmpty(en);
    expect(emptyKeys).toEqual([]);
  });
});
