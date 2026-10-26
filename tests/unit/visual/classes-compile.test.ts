/**
 * @vitest-environment node
 *
 * F-30 · Criterio DIS (1): ninguna clase de `src` se queda sin regla.
 *
 * Una clase de Tailwind que no existe no falla en ningún sitio: simplemente
 * no pinta. Así se quedaron sin fondo la cabecera y 29 pastillas (DIS-1), y
 * así se quedaría sin radio cualquier `rounded-md` ahora que la escala es
 * cerrada (tailwind.config.ts). Este test recorre el código con el parser de
 * TypeScript, saca las cadenas que son clases (atributos `className`,
 * llamadas a `cn`/`clsx`/`cva` y constantes de clases) y pregunta a Tailwind,
 * con el config del repo, si cada una genera CSS. Las que no, tienen que ser
 * clases propias de `globals.css` o marcadores sin estilo (`group`, `peer`).
 *
 * Corre en CI dentro de `npm test` y además como paso propio del job de
 * build (`ci.yml`, «Clases sin regla»), para que el fallo se lea solo.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import ts from "typescript";
import resolveConfig from "tailwindcss/resolveConfig";
// @ts-expect-error -- API interna de Tailwind 3 (la que usa el plugin de Prettier).
import { createContext } from "tailwindcss/lib/lib/setupContextUtils";
import config from "../../../tailwind.config";

const ROOT = resolve(__dirname, "../../..");
const SRC = join(ROOT, "src");

/** Marcadores que Tailwind usa como ancla de variantes y no generan regla. */
const MARKERS = /^(group|peer)(\/[\w-]+)?$/;

/** Nombres de identificador que guardan clases (`FOCUS`, `chipClass`, `CARD_CLS`…). */
const CLASS_HOLDER = /(class|cls|style|styles|focus|ring|link|chip|btn|button|card|row|tone|variant|size|base|wrapper|frame)/i;
const CLASS_FUNCS = new Set(["cn", "clsx", "cx", "cva", "twMerge"]);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry.name) && !/\.d\.ts$/.test(entry.name) ? [full] : [];
  });
}

/** Trozos de texto literal bajo un nodo (cadenas y partes fijas de plantillas). */
function literalPieces(node: ts.Node, out: string[]) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) out.push(node.text);
  else if (ts.isTemplateExpression(node)) {
    // Las uniones con `${}` pueden partir una clase: solo se cuentan los
    // tokens enteros (rodeados de espacio o del borde de la plantilla).
    out.push(node.head.text + " ");
    for (const span of node.templateSpans) out.push(" " + span.literal.text);
  }
  // Una clave de objeto (`{ sm: "h-8" }`) o el índice de un acceso no son clases.
  ts.forEachChild(node, (child) => {
    if (ts.isPropertyAssignment(node) && child === node.name) return;
    if (ts.isElementAccessExpression(node) && child === node.argumentExpression) return;
    if (ts.isBinaryExpression(node) && /^(===|!==|==|!=)$/.test(node.operatorToken.getText())) return;
    if (ts.isCallExpression(child) && !CLASS_FUNCS.has(child.expression.getText())) return;
    literalPieces(child, out);
  });
}

/** Cadenas de clases de un archivo, con su línea. */
/**
 * `strict`: la cadena está en un sitio que SOLO admite clases (`className`,
 * argumentos de `cn`/`clsx`/`cva`): cada token cuenta, también una clase
 * suelta en una expresión (`cond && "rounded-md"`). Si no (constantes cuyo
 * nombre sugiere clases), solo cuenta si alguna de sus palabras es una clase.
 */
function classStrings(file: string): Array<{ text: string; line: number; strict: boolean }> {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: Array<{ text: string; line: number; strict: boolean }> = [];
  const collect = (node: ts.Node, strict: boolean) => {
    const pieces: string[] = [];
    literalPieces(node, pieces);
    const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    for (const text of pieces) found.push({ text, line, strict });
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && /className$/i.test(node.name.getText()) && node.initializer) {
      collect(node.initializer, true);
      return;
    }
    if (ts.isCallExpression(node) && CLASS_FUNCS.has(node.expression.getText())) {
      node.arguments.forEach((arg) => collect(arg, true));
      return;
    }
    if (ts.isVariableDeclaration(node) && node.initializer && CLASS_HOLDER.test(node.name.getText())) {
      collect(node.initializer, false);
      return;
    }
    if (ts.isPropertyAssignment(node) && /className$/i.test(node.name.getText())) {
      collect(node.initializer, true);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** ¿Parece una clase? (descarta frases, rutas, claves de traducción…). */
const CLASS_SHAPE = /^!?-?[a-z0-9@[][a-z0-9:[\]()/._%#,'&>=*+~-]*$/;

let order: (classes: string[]) => Array<[string, bigint | null]>;
let ownClasses: Set<string>;

beforeAll(() => {
  const context = createContext(resolveConfig(config));
  order = (classes) => context.getClassOrder(classes);
  const css = readFileSync(join(SRC, "app/globals.css"), "utf8");
  ownClasses = new Set(Array.from(css.matchAll(/\.([a-zA-Z][\w-]*)/g), (m) => m[1]));
});

describe("criterio DIS (1) · clases sin regla", () => {
  it("el extractor encuentra las clases del código (no está vacío)", () => {
    const sample = classStrings(join(SRC, "components/layout/Header.tsx")).map((s) => s.text).join(" ");
    expect(sample).toContain("bg-surface-default");
    expect(sample).toContain("page-grid");
  });

  it("detecta una clase inexistente (el test sabe fallar)", () => {
    const [[, known], [, unknown]] = order(["rounded-2xl", "rounded-md"]);
    expect(known).not.toBeNull();
    expect(unknown).toBeNull();
  });

  it("una clase suelta en una expresión dentro de className también cuenta", () => {
    const probe = join(ROOT, "tests/unit/visual/__probe__.tsx");
    writeFileSync(probe, 'export const X = ({ on }: { on: boolean }) => <div className={on && "rounded-md"} />;\n');
    try {
      const strings = classStrings(probe);
      expect(strings).toContainEqual(expect.objectContaining({ text: "rounded-md", strict: true }));
    } finally {
      rmSync(probe);
    }
  });

  it("toda clase usada en src genera CSS o es propia de globals.css", () => {
    const missing = new Map<string, string>();
    for (const file of walk(SRC)) {
      for (const { text, line, strict } of classStrings(file)) {
        const tokens = text.split(/\s+/).filter((t) => t && CLASS_SHAPE.test(t));
        if (tokens.length === 0) continue;
        const ranked = order(tokens);
        // Fuera de `className`/`cn`, solo cuenta como cadena de clases si al
        // menos una lo es de verdad: una constante `size = "sm"` no cuenta.
        if (!strict && !ranked.some(([, rank]) => rank !== null)) continue;
        for (const [cls, rank] of ranked) {
          if (rank !== null || MARKERS.test(cls)) continue;
          const bare = cls.replace(/^(?:[\w-]+:|\[[^\]]+\]:)*!?/, "");
          if (ownClasses.has(bare)) continue;
          missing.set(`${relative(ROOT, file)}:${line} ${cls}`, cls);
        }
      }
    }
    expect(Array.from(missing.keys())).toEqual([]);
  }, 60_000);
});
