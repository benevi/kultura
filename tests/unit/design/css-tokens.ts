/**
 * Lee las custom properties del bloque `:root` de `globals.css` y resuelve
 * los alias `var(--x)` hasta su valor literal. Lo comparten los tests de
 * contraste y de documentación del sistema de diseño.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

export const ROOT = resolve(__dirname, "../../..");
export const GLOBALS_CSS = readFileSync(resolve(ROOT, "src/app/globals.css"), "utf8");

function rootBlock(css: string, selector = ":root {"): string {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`globals.css sin bloque ${selector}`);
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(start, i);
  }
  throw new Error(":root sin cerrar");
}

/** Nombre (`--accent-pink`) → valor tal cual está escrito. */
export const RAW_TOKENS: Record<string, string> = Object.fromEntries(
  Array.from(rootBlock(GLOBALS_CSS).replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)).map(
    (m) => [m[1], m[2].trim()]
  )
);

/** Valor final de un token, siguiendo los `var(--x)` encadenados. */
export function resolveToken(name: string, seen: string[] = []): string {
  const raw = RAW_TOKENS[name];
  if (raw === undefined) throw new Error(`Token ${name} no definido en :root`);
  const ref = /^var\((--[\w-]+)\)$/.exec(raw);
  if (!ref) return raw;
  if (seen.includes(ref[1])) throw new Error(`Ciclo de alias en ${name}`);
  return resolveToken(ref[1], [...seen, name]);
}

/** Tokens que redefine `.theme-paper` (páginas impresas), tal cual están escritos. */
export const PAPER_TOKENS: Record<string, string> = Object.fromEntries(
  Array.from(rootBlock(GLOBALS_CSS, ".theme-paper {").replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)).map(
    (m) => [m[1], m[2].trim()]
  )
);

/** Valor final de un token en papel: primero `.theme-paper`, luego `:root`. */
export function resolvePaperToken(name: string, seen: string[] = []): string {
  const raw = PAPER_TOKENS[name] ?? RAW_TOKENS[name];
  if (raw === undefined) throw new Error(`Token ${name} no definido`);
  const ref = /^var\((--[\w-]+)\)$/.exec(raw);
  if (!ref) return raw;
  if (seen.includes(ref[1])) throw new Error(`Ciclo de alias en ${name}`);
  return resolvePaperToken(ref[1], [...seen, name]);
}
