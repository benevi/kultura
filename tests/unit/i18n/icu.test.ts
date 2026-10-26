// @vitest-environment node
/**
 * TXT-7 y paridad: los textos son ICU válido, los dos idiomas piden los
 * mismos valores, el código los pasa todos y ningún contador dice "1 títulos".
 */
import { describe, it, expect } from "vitest";
import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { IntlMessageFormat } from "intl-messageformat";
import es from "../../../messages/es.json";
import en from "../../../messages/en.json";
import { flatten, join, scan } from "./scan";

type Tree = { [key: string]: string | Tree };
const LOCALES = { es: flatten(es as Tree), en: flatten(en as Tree) } as const;

type Arg = { name: string; kind: "plain" | "number" | "date" | "plural" | "select" };

function args(elements: MessageFormatElement[], out = new Map<string, Arg["kind"]>(), tags = new Set<string>()) {
  for (const el of elements) {
    if (el.type === TYPE.argument) out.set(el.value, out.get(el.value) ?? "plain");
    else if (el.type === TYPE.number) out.set(el.value, "number");
    else if (el.type === TYPE.date || el.type === TYPE.time) out.set(el.value, "date");
    else if (el.type === TYPE.plural || el.type === TYPE.select) {
      out.set(el.value, el.type === TYPE.plural ? "plural" : "select");
      for (const opt of Object.values(el.options)) args(opt.value, out, tags);
    } else if (el.type === TYPE.tag) {
      tags.add(el.value);
      args(el.children, out, tags);
    }
  }
  return { args: out, tags };
}

// El análisis se hace al cargar el archivo, fuera del tiempo de cada test.
const REFS = scan().refs;

const parsed = (locale: "es" | "en", key: string) => args(parse(LOCALES[locale].get(key)!, { ignoreTag: false }));

describe("ICU — sintaxis y paridad es/en", () => {
  it.each(["es", "en"] as const)("todos los textos de %s.json son ICU válido", (locale) => {
    const broken: string[] = [];
    for (const [key, value] of Array.from(LOCALES[locale])) {
      try {
        parse(value);
      } catch (e) {
        broken.push(`${key}: ${(e as Error).message}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("es y en piden los mismos valores, del mismo tipo, y las mismas etiquetas", () => {
    const diff: string[] = [];
    for (const key of Array.from(LOCALES.es.keys())) {
      if (!LOCALES.en.has(key)) continue;
      const a = parsed("es", key);
      const b = parsed("en", key);
      const fmt = (m: Map<string, string>) => Array.from(m).map(([k, v]) => `${k}:${v === "plain" || v === "number" ? "valor" : v}`).sort().join(",");
      if (fmt(a.args) !== fmt(b.args)) diff.push(`${key}: es{${fmt(a.args)}} en{${fmt(b.args)}}`);
      if ([...a.tags].sort().join() !== [...b.tags].sort().join()) diff.push(`${key}: etiquetas distintas`);
    }
    expect(diff).toEqual([]);
  });

  it("el código pasa todos los valores que pide cada texto", () => {
    const missing: string[] = [];
    for (const ref of REFS) {
      if (ref.arg.kind !== "literal" || ref.values === null || ref.method === "raw" || ref.method === "has") continue;
      for (const ns of ref.namespaces ?? []) {
        const key = join(ns, ref.arg.value);
        if (!LOCALES.es.has(key)) continue;
        const need = Array.from(parsed("es", key).args.keys()).filter((a) => !ref.values!.includes(a));
        if (need.length) missing.push(`${ref.file}:${ref.line} ${key} sin {${need.join(", ")}}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

/** Sustantivos contables: detrás de un "1" van en singular. */
const PLURAL_NOUNS =
  /(?<![\d.,])1 (títulos|miembros|listas|días|valoraciones|votos|años|veces|temporadas|votes|years|times|seasons|caracteres|notas|estrellas|mensajes|amistades|apuntes|filas|horas|minutos|segundos|episodios|capítulos|páginas|novedades|sugerencias|conversaciones|resultados|amigos|titles|members|lists|days|characters|ratings|stars|messages|friendships|entries|rows|hours|minutes|episodes|chapters|pages|updates|suggestions|conversations|results|friends)\b/;

function formatWithOnes(locale: "es" | "en", message: string): string {
  const { args: a, tags } = args(parse(message));
  const values: Record<string, unknown> = {};
  for (const [name, kind] of Array.from(a)) values[name] = kind === "date" ? new Date(2026, 0, 1) : kind === "select" ? "other" : 1;
  for (const tag of Array.from(tags)) values[tag] = (chunks: unknown[]) => chunks.join("");
  const out = new IntlMessageFormat(message, locale).format(values);
  return Array.isArray(out) ? out.join("") : String(out);
}

describe("TXT-7 — ICU en todos los contadores", () => {
  it.each(["es", "en"] as const)("ningún texto de %s dice «1 títulos» con un 1", (locale) => {
    const wrong: string[] = [];
    for (const [key, value] of Array.from(LOCALES[locale])) {
      if (!/\{/.test(value)) continue;
      const text = formatWithOnes(locale, value);
      if (PLURAL_NOUNS.test(text)) wrong.push(`${key}: ${text}`);
    }
    expect(wrong).toEqual([]);
  });

  it.each([
    ["library.items", "1 título", "1 title"],
    ["lists.itemCount", "1 título", "1 title"],
    ["collection.items", "1 título", "1 title"],
    ["profile.genreCount", "1 título", "1 title"],
    ["groups.membersCount", "1 miembro", "1 member"],
    ["settings.importDataSuccess", "1 título y 1 lista", "1 title and 1 list"],
  ])("%s: «%s» / «%s»", (key, esText, enText) => {
    expect(formatWithOnes("es", LOCALES.es.get(key)!)).toContain(esText);
    expect(formatWithOnes("en", LOCALES.en.get(key)!)).toContain(enText);
  });

  it("el perfil concuerda la etiqueta con su cifra", () => {
    expect(formatWithOnes("es", LOCALES.es.get("profile.totalItems")!)).toBe("título");
    expect(new IntlMessageFormat(LOCALES.es.get("profile.totalItems")!, "es").format({ count: 2 })).toBe("títulos");
    expect(formatWithOnes("es", LOCALES.es.get("profile.completed")!)).toBe("completado");
  });
});
