// @vitest-environment node
/**
 * TXT, criterio (1): ningún `MISSING_MESSAGE`.
 *
 * Recorre todos los traductores de `src/**` (ver `scan.ts`) y comprueba en
 * es.json y en.json que existe:
 * - cada namespace pedido (`useTranslations('mediaDetail')` con la clave real
 *   `media_detail` fue un fallo de verdad, TXT-3);
 * - cada clave literal, como texto (o como subárbol si se lee con `t.raw`);
 * - al menos una clave para cada plantilla (`t(\`chip.${f}\`)`).
 * Las claves en variables se comprueban en `dead-keys.test.ts` desde el otro
 * lado (los literales del archivo que son claves cuentan como usados).
 */
import { describe, it, expect } from "vitest";
import es from "../../../messages/es.json";
import en from "../../../messages/en.json";
import { flatten, join, scan, type Ref } from "./scan";

type Tree = { [key: string]: string | Tree };
const LOCALES = { es: flatten(es as Tree), en: flatten(en as Tree) };
const S = scan();

function branches(leaves: Map<string, string>) {
  const set = new Set<string>([""]);
  for (const key of Array.from(leaves.keys())) {
    const parts = key.split(".");
    for (let i = 1; i < parts.length; i++) set.add(parts.slice(0, i).join("."));
  }
  return set;
}
const BRANCHES = { es: branches(LOCALES.es), en: branches(LOCALES.en) };

const where = (r: { file: string; line: number }) => `${r.file}:${r.line}`;

function existsIn(locale: "es" | "en", ns: string, ref: Ref): boolean {
  const leaves = LOCALES[locale];
  if (ref.arg.kind === "literal") {
    const full = join(ns, ref.arg.value);
    return ref.method === "raw" ? leaves.has(full) || BRANCHES[locale].has(full) : leaves.has(full);
  }
  if (ref.arg.kind === "template") {
    const prefix = ns ? `${ns}.` : "";
    const re = ref.arg.regex;
    return Array.from(leaves.keys()).some((k) => k.startsWith(prefix) && re.test(k.slice(prefix.length)));
  }
  return true;
}

describe("TXT criterio 1 — ningún MISSING_MESSAGE", () => {
  it("el análisis encuentra los traductores y sus claves (sanidad)", () => {
    expect(S.factories.length).toBeGreaterThan(200);
    expect(S.refs.filter((r) => r.arg.kind === "literal").length).toBeGreaterThan(1000);
    // El caso de LegalDocument: namespace en una variable, resuelto por los literales.
    const legal = S.factories.find((f) => f.file.endsWith("LegalDocument.tsx") && !f.literal);
    expect(legal?.namespaces).toEqual(expect.arrayContaining(["legal.privacy", "accessibility"]));
  });

  it.each(["es", "en"] as const)("cada namespace pedido existe en %s.json", (locale) => {
    const missing = S.factories
      .filter((f) => f.literal)
      .flatMap((f) => (f.namespaces ?? []).filter((ns) => !BRANCHES[locale].has(ns)).map((ns) => `${where(f)} ${ns}`));
    expect(missing).toEqual([]);
  });

  it.each(["es", "en"] as const)("cada clave pedida existe en %s.json", (locale) => {
    const missing: string[] = [];
    for (const ref of S.refs) {
      if (ref.method === "has" || ref.arg.kind === "variable") continue;
      const label = ref.arg.kind === "literal" ? ref.arg.value : ref.arg.text;
      if (ref.namespaces === null) {
        // Traductor recibido por parámetro sin namespace en el tipo: vale
        // si la clave existe bajo alguno de los namespaces del archivo.
        // Sin ninguno (módulo de ayuda que recibe el traductor), bajo cualquiera.
        const own = S.factories.filter((f) => f.file === ref.file).flatMap((f) => f.namespaces ?? []);
        const candidates = own.length ? own : Array.from(BRANCHES[locale]);
        if (!candidates.some((ns) => existsIn(locale, ns, ref))) missing.push(`${where(ref)} ?.${label}`);
        continue;
      }
      for (const ns of ref.namespaces) {
        if (!existsIn(locale, ns, ref)) missing.push(`${where(ref)} ${join(ns, label)}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
