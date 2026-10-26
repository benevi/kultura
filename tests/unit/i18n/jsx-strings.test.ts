// @vitest-environment node
/**
 * TXT, criterio (2): ningún texto fijo en el JSX ni emojis en la interfaz.
 *
 * Recorre cada `.tsx` con el compilador de TypeScript y mira el texto de
 * los nodos JSX, los atributos que se LEEN (`alt`, `title`, `placeholder`,
 * `aria-label`, `label`, `*Label`, `*Text`…; no `aria-labelledby`, `field`
 * o `seed`), las ramas literales de `a ? b : 'c'` y `a || 'c'` en los hijos
 * y los `title`/`description` fijos de `metadata`.
 *
 * `KNOWN_DEBT` está vacía: el test falla si aparece una cadena nueva y
 * también si se arregla una de la lista sin quitarla (la lista no miente).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { ROOT, SRC, walk } from "./scan";

/**
 * Nombres propios y marcas: no se traducen. Los nombres de idioma van en su
 * propia lengua en el selector («Español», «English»), como en cualquier web.
 */
const PROPER = new RegExp("(?<!\\p{L})(KULTURA|kultura|WhatsApp|Wikidata|Metacritic|JustWatch|Aa|English|Español)(?!\\p{L})", "gu");
const LETTERS = /[A-Za-zÁ-úñÑ]{2,}/;
/** ★ y ▶ son glifos tipográficos de la nota y de "seguir", no emojis. */
const EMOJI = new RegExp("(?![\\u2605\\u25B6\\u00A9\\u00AE\\u2122])\\p{Extended_Pictographic}", "u");
const TEXT_ATTRS = new Set(["alt", "title", "placeholder", "label", "aria-label", "aria-description", "aria-valuetext", "aria-roledescription", "children"]);
const NOT_TEXT = new Set(["enterKeyHint"]);
const isTextAttr = (name: string) =>
  !NOT_TEXT.has(name) && (TEXT_ATTRS.has(name) || /(Label|Text|Title|Message|Hint|Description|Placeholder|Heading|Caption)$/.test(name));

type Finding = { file: string; kind: "texto" | "emoji" | "metadata"; text: string };

function clean(text: string) {
  return text
    .replace(/&[a-z]+;/g, " ")
    .replace(/\$\{[^}]*\}/g, " ")
    .replace(PROPER, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function literalBranches(e: ts.Expression): string[] {
  if (ts.isParenthesizedExpression(e)) return literalBranches(e.expression);
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return [e.text];
  // De una plantilla solo cuenta lo literal: `#1 ${top}` → "#1".
  if (ts.isTemplateExpression(e)) return [[e.head.text, ...e.templateSpans.map((sp) => sp.literal.text)].join(" ")];
  if (ts.isConditionalExpression(e)) return [...literalBranches(e.whenTrue), ...literalBranches(e.whenFalse)];
  if (ts.isBinaryExpression(e) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(e.operatorToken.kind)) {
    return [...literalBranches(e.left), ...literalBranches(e.right)];
  }
  return [];
}

function findings(): Finding[] {
  const out: Finding[] = [];
  for (const file of walk(SRC, /\.tsx?$/)) {
    const rel = path.relative(ROOT, file);
    const text = fs.readFileSync(file, "utf8");
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const push = (raw: string) => {
      if (EMOJI.test(raw)) out.push({ file: rel, kind: "emoji", text: raw.trim() });
      else if (LETTERS.test(clean(raw))) out.push({ file: rel, kind: "texto", text: raw.replace(/\s+/g, " ").trim() });
    };
    const inMetadata = (n: ts.Node) => {
      for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
        if (ts.isFunctionDeclaration(p) && p.name?.text === "generateMetadata") return true;
        if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name) && p.name.text === "metadata") return true;
      }
      return false;
    };
    const visit = (n: ts.Node) => {
      if (ts.isJsxText(n)) {
        const t = n.getText();
        if (EMOJI.test(t) || LETTERS.test(clean(t))) push(t);
      } else if (ts.isJsxAttribute(n) && n.initializer) {
        const name = n.name.getText(sf);
        const values = ts.isStringLiteral(n.initializer)
          ? [n.initializer.text]
          : ts.isJsxExpression(n.initializer) && n.initializer.expression
            ? literalBranches(n.initializer.expression)
            : [];
        for (const v of values) {
          if (isTextAttr(name)) push(v);
          else if (EMOJI.test(v)) out.push({ file: rel, kind: "emoji", text: `${name}=${v}` });
        }
      } else if (ts.isJsxExpression(n) && n.expression && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))) {
        for (const v of literalBranches(n.expression)) push(v);
      } else if (
        ts.isPropertyAssignment(n) &&
        ["title", "description"].includes(n.name.getText(sf)) &&
        (ts.isStringLiteral(n.initializer) || ts.isNoSubstitutionTemplateLiteral(n.initializer)) &&
        rel.startsWith("src/app/") &&
        inMetadata(n) &&
        LETTERS.test(clean(n.initializer.text))
      ) {
        out.push({ file: rel, kind: "metadata", text: `${n.name.getText(sf)}: ${n.initializer.text}` });
      } else if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && EMOJI.test(n.text) && !ts.isJsxAttribute(n.parent)) {
        // Emojis en literales sueltos (listas de opciones, plantillas de badges).
        out.push({ file: rel, kind: "emoji", text: n.text });
      } else if (ts.isTemplateExpression(n) && EMOJI.test(n.getText()) && !ts.isJsxExpression(n.parent)) {
        out.push({ file: rel, kind: "emoji", text: n.getText() });
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return out;
}

/**
 * Deuda conocida: vacía. Una entrada nueva solo se acepta con su archivo y
 * mientras se mueve el texto a `messages/*.json` (o el emoji a un icono de
 * `src/components/icons`); el test falla si la lista miente.
 */
const KNOWN_DEBT: Finding[] = [];

const id = (f: Finding) => `${f.file} | ${f.kind} | ${f.text}`;

describe("TXT criterio 2 — sin cadenas fijas ni emojis en la interfaz", () => {
  const found = findings();

  it("el parser encuentra lo que debe (sanidad)", () => {
    // Las marcas no cuentan, los atributos técnicos tampoco.
    expect(found.some((f) => /aria-labelledby|testId|seed/.test(f.text))).toBe(false);
    expect(found.every((f) => f.text.length > 0)).toBe(true);
  });

  it("solo queda la deuda conocida, con su archivo", () => {
    const now = new Set(found.map(id));
    const known = new Set(KNOWN_DEBT.map(id));
    expect(Array.from(now).filter((x) => !known.has(x)).sort(), "cadenas nuevas").toEqual([]);
    expect(Array.from(known).filter((x) => !now.has(x)).sort(), "deuda ya arreglada: quitarla de KNOWN_DEBT").toEqual([]);
  });
});
