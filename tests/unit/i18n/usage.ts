/**
 * Qué claves de es.json usa el código (TXT-8). Una clave cuenta como usada si:
 * - un traductor la pide literal (`t('k')`), o su subárbol con `t.raw`;
 * - encaja en una plantilla (`t(\`chip.${f}\`)`);
 * - un traductor la pide en una variable (`t(opt.labelKey)`) y el literal
 *   aparece en el archivo o en lo que importa (las listas de claves);
 * - se lee del JSON directamente (`es.errors.goHome`, `messages.share.og`).
 */
import es from "../../../messages/es.json";
import { flatten, join, literalsAround, scan, type Scan } from "./scan";

type Tree = { [key: string]: string | Tree };
export const ES = flatten(es as Tree);
const KEYS = Array.from(ES.keys());

/** Hojas bajo cada rama ("library.empty" → sus claves). */
const LEAVES_UNDER = new Map<string, string[]>();
/** Claves por su último tramo ("title" → todas las que acaban en `.title`). */
const BY_SUFFIX = new Map<string, string[]>();
for (const key of KEYS) {
  const parts = key.split(".");
  for (let i = 1; i < parts.length; i++) {
    const branch = parts.slice(0, i).join(".");
    if (!LEAVES_UNDER.has(branch)) LEAVES_UNDER.set(branch, []);
    LEAVES_UNDER.get(branch)!.push(key);
    const suffix = parts.slice(i).join(".");
    if (!BY_SUFFIX.has(suffix)) BY_SUFFIX.set(suffix, []);
    BY_SUFFIX.get(suffix)!.push(key);
  }
}

const under = (prefix: string): string[] => (ES.has(prefix) ? [prefix] : LEAVES_UNDER.get(prefix) ?? []);

export function usedKeys(s: Scan = scan()): Set<string> {
  const used = new Set<string>();
  const add = (keys: string[]) => keys.forEach((k) => used.add(k));
  const fileNs = new Map<string, string[]>();
  for (const f of s.factories) fileNs.set(f.file, [...(fileNs.get(f.file) ?? []), ...(f.namespaces ?? [])]);

  for (const ref of s.refs) {
    const own = fileNs.get(ref.file) ?? [];
    const namespaces = ref.namespaces ?? (own.length ? own : null);
    if (ref.arg.kind === "literal") {
      const key = ref.arg.value;
      if (namespaces) for (const ns of namespaces) add(under(join(ns, key)));
      // Sin namespace conocido: la clave, bajo cualquier namespace que la tenga.
      else add([...(BY_SUFFIX.get(key) ?? []), ...under(key)]);
    } else if (ref.arg.kind === "template") {
      const re = ref.arg.regex;
      for (const ns of namespaces ?? [""]) {
        const pool = ns ? LEAVES_UNDER.get(ns) ?? [] : KEYS;
        const prefix = ns ? `${ns}.` : "";
        add(pool.filter((k) => re.test(k.slice(prefix.length))));
      }
    } else {
      for (const lit of Array.from(literalsAround(s, ref.file))) {
        if (!lit) continue;
        if (namespaces) for (const ns of namespaces) add(under(join(ns, lit)));
        else add(BY_SUFFIX.get(lit) ?? []);
      }
    }
  }

  for (const { names } of s.jsonChains) {
    for (let i = 0; i < names.length - 1; i++) add(under(names.slice(i).join(".")));
  }
  return used;
}
