/**
 * REN-5: el proveedor de textos del navegador solo lleva los namespaces que
 * usan los componentes cliente. Este test recorre el grafo de imports desde
 * cada archivo "use client" (todo lo que importa un componente cliente también
 * se ejecuta en el navegador) y comprueba que cada `useTranslations("ns")`
 * queda cubierto:
 * - por `APP_CLIENT_NAMESPACES` (proveedor de `(app)/template.tsx`) si se
 *   alcanza desde un archivo de `(app)`;
 * - por la lista de su zona (`report/`, `welcome/`, `media/`, con proveedor
 *   en su layout) si se alcanza desde ella; en `media/` el propio layout
 *   pinta la cabecera y la barra FUERA de su proveedor, así que cuenta como
 *   shell (igual que el layout de `(app)`);
 * - por `SHELL_CLIENT_NAMESPACES` (proveedor de `[locale]/layout.tsx`) si se
 *   alcanza desde el resto de páginas públicas o desde el propio layout de
 *   `(app)`, que queda por encima del template.
 * Un proveedor anidado sustituye al de fuera, así que cada lista es completa.
 * También falla si sobra un namespace (peso inútil en cada página) o si se
 * usa un namespace no literal, que no se puede comprobar.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import es from "../../../messages/es.json";
import en from "../../../messages/en.json";
import {
  APP_CLIENT_NAMESPACES,
  MEDIA_CLIENT_NAMESPACES,
  REPORT_CLIENT_NAMESPACES,
  WELCOME_CLIENT_NAMESPACES,
  SHELL_CLIENT_NAMESPACES,
  pickMessages,
} from "@/i18n/client-messages";

const ROOT = path.resolve(__dirname, "../../..");
const SRC = path.join(ROOT, "src");
const APP_GROUP = path.join(SRC, "app", "[locale]", "(app)") + path.sep;
const APP_GROUP_SHELL = ["layout.tsx", "template.tsx"].map((f) => APP_GROUP + f);
// Zonas públicas con proveedor propio en su layout (sustituye al del shell).
// `shell`: archivos de la zona que pintan por ENCIMA de su proveedor.
const ZONES = [
  { dir: "report", list: REPORT_CLIENT_NAMESPACES, file: "src/app/[locale]/report/PublicReportForm.tsx", shell: [] },
  { dir: "welcome", list: WELCOME_CLIENT_NAMESPACES, file: "src/app/[locale]/welcome/WelcomeFlow.tsx", shell: [] },
  { dir: "media", list: MEDIA_CLIENT_NAMESPACES, file: "src/components/library/LibraryAction.tsx", shell: ["layout.tsx"] },
].map((z) => {
  const dir = path.join(SRC, "app", "[locale]", z.dir) + path.sep;
  return { ...z, path: dir, shellFiles: z.shell.map((f) => dir + f) };
});
const inZone = (z: (typeof ZONES)[number], f: string) => f.startsWith(z.path) && !z.shellFiles.includes(f);

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const FILES = new Map(
  walk(SRC).map((file) => [file, fs.readFileSync(file, "utf8").replace(/^﻿/, "")]),
);

const IMPORT_RE =
  /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|^import\s+['"]([^'"]+)['"]/gm;

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (FILES.has(candidate)) return candidate;
  }
  return null;
}

function reachable(entries: string[]): Set<string> {
  const seen = new Set<string>();
  const stack = [...entries];
  while (stack.length) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const match of Array.from(FILES.get(file)!.matchAll(IMPORT_RE))) {
      const target = resolveImport(file, match[1] ?? match[2] ?? match[3]);
      if (target && !seen.has(target)) stack.push(target);
    }
  }
  return seen;
}

const isClient = (source: string) =>
  /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*['"]use client['"]/.test(source);

const clientGraph = reachable(
  Array.from(FILES.entries())
    .filter(([, src]) => isClient(src))
    .map(([f]) => f),
);
const shellEntries = Array.from(FILES.keys()).filter(
  (f) =>
    f.startsWith(path.join(SRC, "app") + path.sep) &&
    (!f.startsWith(APP_GROUP) || APP_GROUP_SHELL.includes(f)) &&
    !ZONES.some((z) => inZone(z, f)),
);
const zoneUses = ZONES.map((z) => ({
  ...z,
  ...translationUses(
    Array.from(reachable(Array.from(FILES.keys()).filter((f) => inZone(z, f)))).filter((f) =>
      clientGraph.has(f),
    ),
  ),
}));
const shellClientGraph = Array.from(reachable(shellEntries)).filter((f) => clientGraph.has(f));

type Use = { file: string; ns: string };

function translationUses(files: string[]): { uses: Use[]; dynamic: Use[] } {
  const uses: Use[] = [];
  const dynamic: Use[] = [];
  for (const file of files) {
    const source = FILES.get(file)!;
    const rel = path.relative(ROOT, file);
    for (const match of Array.from(source.matchAll(/useTranslations\(([^)]*)\)/g))) {
      const arg = match[1].trim();
      const literal = arg.match(/^['"`]([^'"`$]+)['"`]$/);
      if (literal) uses.push({ file: rel, ns: literal[1] });
      else dynamic.push({ file: rel, ns: arg || "(sin namespace)" });
    }
    if (/\buseMessages\s*\(/.test(source)) dynamic.push({ file: rel, ns: "useMessages()" });
  }
  return { uses, dynamic };
}

const covers = (picked: readonly string[], ns: string) =>
  picked.some((p) => ns === p || ns.startsWith(`${p}.`));

const allUses = translationUses(Array.from(clientGraph));
// Lo que se pinta dentro del template de (app): sus archivos y lo que importan.
const appUses = translationUses(
  Array.from(reachable(Array.from(FILES.keys()).filter((f) => f.startsWith(APP_GROUP)))).filter((f) =>
    clientGraph.has(f),
  ),
);
const shellUses = translationUses(shellClientGraph);

describe("REN-5 — textos del navegador por namespaces", () => {
  it("el grafo encuentra componentes cliente con textos (sanidad del análisis)", () => {
    expect(appUses.uses.length).toBeGreaterThan(40);
    // Ningún componente cliente que se use queda fuera de todas las zonas
    // (los que no importa nadie no se pintan: código muerto).
    const imported = new Set(
      Array.from(FILES.keys()).flatMap((f) =>
        Array.from(FILES.get(f)!.matchAll(IMPORT_RE)).map((m) => resolveImport(f, m[1] ?? m[2] ?? m[3])),
      ),
    );
    const zoned = new Set([...appUses.uses, ...shellUses.uses, ...zoneUses.flatMap((z) => z.uses)].map((u) => u.file));
    const orphanFree = allUses.uses.filter((u) => imported.has(path.join(ROOT, u.file)) && !zoned.has(u.file));
    expect(orphanFree).toEqual([]);
    expect(shellUses.uses.map((u) => u.file)).toContain("src/app/[locale]/login/LoginPage.tsx");
    // Cabecera y barra del layout de (app) quedan por encima del template.
    expect(shellUses.uses.map((u) => u.file)).toContain("src/components/layout/BottomNav.tsx");
  });

  it("ningún componente cliente pide un namespace no literal o todos los mensajes", () => {
    expect(allUses.dynamic).toEqual([]);
  });

  it("todo namespace usado en el navegador está en APP_CLIENT_NAMESPACES", () => {
    const missing = appUses.uses.filter((u) => !covers(APP_CLIENT_NAMESPACES, u.ns));
    expect(missing).toEqual([]);
  });

  it("todo namespace usado fuera de la zona con sesión está en SHELL_CLIENT_NAMESPACES", () => {
    const missing = shellUses.uses.filter((u) => !covers(SHELL_CLIENT_NAMESPACES, u.ns));
    expect(missing).toEqual([]);
  });

  it.each(zoneUses)("todo namespace usado en /$dir está en su lista (su proveedor sustituye al del shell)", (zone) => {
    expect(zone.uses.map((u) => u.file)).toContain(zone.file);
    expect(zone.dynamic).toEqual([]);
    const missing = zone.uses.filter((u) => !covers(zone.list, u.ns));
    expect(missing).toEqual([]);
  });

  it("no sobra ningún namespace en las listas", () => {
    const unused = (picked: readonly string[], uses: Use[]) =>
      picked.filter((p) => !uses.some((u) => covers([p], u.ns)));
    expect(unused(APP_CLIENT_NAMESPACES, appUses.uses)).toEqual([]);
    expect(unused(SHELL_CLIENT_NAMESPACES, shellUses.uses)).toEqual([]);
    for (const zone of zoneUses) expect(unused(zone.list, zone.uses), zone.dir).toEqual([]);
  });

  it.each([
    ["es", es],
    ["en", en],
  ])("todas las rutas existen en %s.json", (_locale, messages) => {
    for (const ns of [
      ...APP_CLIENT_NAMESPACES,
      ...SHELL_CLIENT_NAMESPACES,
      ...REPORT_CLIENT_NAMESPACES,
      ...WELCOME_CLIENT_NAMESPACES,
      ...MEDIA_CLIENT_NAMESPACES,
    ]) {
      const picked = pickMessages(messages, [ns]);
      expect(Object.keys(picked), ns).toHaveLength(1);
    }
  });
});

describe("pickMessages", () => {
  const messages = { a: { x: "1", y: { z: "2" } }, b: { k: "3" }, c: "4" };

  it("copia namespaces enteros y ramas con puntos", () => {
    expect(pickMessages(messages, ["b", "a.y"])).toEqual({ b: { k: "3" }, a: { y: { z: "2" } } });
  });

  it("ignora rutas que no existen y no muta el original", () => {
    expect(pickMessages(messages, ["nope", "a.nope"])).toEqual({});
    expect(messages.a.x).toBe("1");
  });

  it("el shell pesa una fracción del catálogo", () => {
    const size = (v: unknown) => JSON.stringify(v).length;
    expect(size(pickMessages(es, SHELL_CLIENT_NAMESPACES))).toBeLessThan(size(es) * 0.3);
    expect(size(pickMessages(es, APP_CLIENT_NAMESPACES))).toBeLessThan(size(es));
  });
});
