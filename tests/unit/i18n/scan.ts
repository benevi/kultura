/**
 * Análisis estático de los textos de la app (TXT, criterios 1 y 2).
 *
 * Recorre `src/**` con el compilador de TypeScript (no con expresiones
 * regulares) y encuentra:
 * - cada traductor (`useTranslations`, `getTranslations`, `createTranslator`)
 *   con su namespace, respetando el ámbito: dos `const t` en funciones
 *   distintas del mismo archivo no se confunden;
 * - cada llamada a ese traductor (`t('k')`, `t.rich`, `t.markup`, `t.raw`,
 *   `t.has`) con su clave literal, su plantilla (`t(\`chip.${f}\`)`) o su
 *   variable (`t(opt.labelKey)`);
 * - los accesos directos al JSON (`es.errors.goHome`) en los archivos que lo
 *   importan (imágenes OG, correos, manifiesto).
 *
 * Lo usan `missing-messages.test.ts` (ninguna clave pedida falta) y
 * `dead-keys.test.ts` (ninguna clave sobra).
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import es from "../../../messages/es.json";

export const ROOT = path.resolve(__dirname, "../../..");
export const SRC = path.join(ROOT, "src");

type Tree = { [key: string]: string | Tree };

export function flatten(obj: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(full, value);
    else for (const [k, v] of Array.from(flatten(value, full))) out.set(k, v);
  }
  return out;
}

const ES_LEAVES = flatten(es as Tree);
/** Rutas que son objetos (namespaces y subárboles), con la raíz "". */
const ES_BRANCHES = new Set<string>([""]);
for (const key of Array.from(ES_LEAVES.keys())) {
  const parts = key.split(".");
  for (let i = 1; i < parts.length; i++) ES_BRANCHES.add(parts.slice(0, i).join("."));
}
export const isBranch = (p: string) => ES_BRANCHES.has(p);

export function walk(dir: string, re = /\.(ts|tsx)$/): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, re);
    return re.test(entry.name) ? [full] : [];
  });
}

export type KeyArg =
  | { kind: "literal"; value: string }
  | { kind: "template"; text: string; regex: RegExp }
  | { kind: "variable"; text: string };

export type Ref = {
  file: string;
  line: number;
  method: "call" | "rich" | "markup" | "raw" | "has";
  /** Namespaces posibles; `null` = traductor recibido por parámetro sin tipo. */
  namespaces: string[] | null;
  arg: KeyArg;
  /**
   * Nombres de los valores que recibe (`t('k', { count })` → ["count"]);
   * `[]` sin segundo argumento; `null` si no es un objeto literal (un spread,
   * una variable) y no se puede saber.
   */
  values: string[] | null;
};

export type Factory = { file: string; line: number; namespaces: string[] | null; literal: boolean };

export type Scan = {
  refs: Ref[];
  factories: Factory[];
  /** Cadenas de acceso al JSON de mensajes (`["errors", "goHome"]`). */
  jsonChains: { file: string; names: string[] }[];
  /** Literales de texto de cada archivo (para resolver claves en variables). */
  literals: Map<string, Set<string>>;
  /** Imports locales resueltos de cada archivo. */
  imports: Map<string, string[]>;
};

const FACTORIES = new Set(["useTranslations", "getTranslations", "createTranslator", "useImportT"]);
/** Traductores propios con namespace fijo (`src/lib/import/i18n.tsx`). */
const FIXED_NAMESPACE: Record<string, string> = { useImportT: "import" };
const METHODS = new Set(["rich", "markup", "raw", "has"]);
const TRANSLATOR_PARAM = /^t[A-Z0-9]?\w*$/;

function unwrap(node: ts.Expression): ts.Expression {
  let n = node;
  for (;;) {
    if (ts.isAwaitExpression(n) || ts.isParenthesizedExpression(n) || ts.isNonNullExpression(n)) n = n.expression;
    else if (ts.isAsExpression(n) || ts.isTypeAssertionExpression(n) || ts.isSatisfiesExpression(n)) n = n.expression;
    else return n;
  }
}

function stringOf(node: ts.Node | undefined): string | null {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function keyArgs(node: ts.Expression): KeyArg[] {
  const n = unwrap(node);
  const literal = stringOf(n);
  if (literal !== null) return [{ kind: "literal", value: literal }];
  if (ts.isTemplateExpression(n)) {
    const source =
      escapeRe(n.head.text) + n.templateSpans.map((s) => `[^]+?${escapeRe(s.literal.text)}`).join("");
    return [{ kind: "template", text: n.getText(), regex: new RegExp(`^${source}$`) }];
  }
  if (ts.isConditionalExpression(n)) return [...keyArgs(n.whenTrue), ...keyArgs(n.whenFalse)];
  return [{ kind: "variable", text: n.getText() }];
}

const isFunctionLike = (n: ts.Node): n is ts.SignatureDeclaration =>
  ts.isFunctionDeclaration(n) ||
  ts.isFunctionExpression(n) ||
  ts.isArrowFunction(n) ||
  ts.isMethodDeclaration(n) ||
  ts.isConstructorDeclaration(n) ||
  ts.isGetAccessorDeclaration(n) ||
  ts.isSetAccessorDeclaration(n);

function scopeOf(node: ts.Node): ts.Node {
  let n: ts.Node | undefined = node.parent;
  while (n && !isFunctionLike(n) && !ts.isSourceFile(n)) n = n.parent;
  return n ?? node.getSourceFile();
}

type Binding = { namespaces: string[] | null } | "shadow";

function resolveImport(from: string, spec: string, files: Set<string>): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (files.has(c)) return c;
  }
  return null;
}

export function scan(): Scan {
  const files = walk(SRC);
  const fileSet = new Set(files);
  const out: Scan = { refs: [], factories: [], jsonChains: [], literals: new Map(), imports: new Map() };

  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const text = fs.readFileSync(file, "utf8");
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const line = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
    const literals = new Set<string>();
    const imports: string[] = [];
    const jsonIdents = new Set<string>();
    const scopes = new Map<ts.Node, Map<string, Binding>>();
    const bind = (scope: ts.Node, name: string, b: Binding) => {
      if (!scopes.has(scope)) scopes.set(scope, new Map());
      scopes.get(scope)!.set(name, b);
    };

    // Namespace de un traductor que no es literal: los literales del archivo
    // que son namespaces reales (p. ej. `DOCS[doc].namespace` en LegalDocument).
    const fileNamespaces = () => Array.from(literals).filter((l) => l !== "" && isBranch(l));

    const pending: { scope: ts.Node; name: string; arg: ts.Expression | undefined; node: ts.Node }[] = [];

    const factoryArg = (call: ts.CallExpression): ts.Expression | undefined => call.arguments[0];

    const visit = (node: ts.Node) => {
      const lit = stringOf(node);
      if (lit !== null) literals.add(lit);

      if (ts.isImportDeclaration(node)) {
        const spec = stringOf(node.moduleSpecifier);
        if (spec) {
          const target = resolveImport(file, spec, fileSet);
          if (target) imports.push(target);
          if (/messages\/(es|en)\.json$/.test(spec) && node.importClause?.name) jsonIdents.add(node.importClause.name.text);
        }
      }

      if (ts.isVariableDeclaration(node) && node.initializer) {
        const init = unwrap(node.initializer);
        if (ts.isIdentifier(node.name)) {
          if (ts.isCallExpression(init) && ts.isIdentifier(init.expression) && FACTORIES.has(init.expression.text)) {
            const fixed = FIXED_NAMESPACE[init.expression.text];
            const arg = fixed ? ts.factory.createStringLiteral(fixed) : factoryArg(init);
            pending.push({ scope: scopeOf(node), name: node.name.text, arg, node: init });
          } else {
            bind(scopeOf(node), node.name.text, "shadow");
          }
        } else if (
          ts.isArrayBindingPattern(node.name) &&
          ts.isCallExpression(init) &&
          init.expression.getText(sf) === "Promise.all" &&
          init.arguments[0] &&
          ts.isArrayLiteralExpression(init.arguments[0])
        ) {
          const elements = init.arguments[0].elements;
          node.name.elements.forEach((el, i) => {
            if (!ts.isBindingElement(el) || !ts.isIdentifier(el.name)) return;
            const item = elements[i] ? unwrap(elements[i]) : undefined;
            if (item && ts.isCallExpression(item) && ts.isIdentifier(item.expression) && FACTORIES.has(item.expression.text)) {
              pending.push({ scope: scopeOf(node), name: el.name.text, arg: factoryArg(item), node: item });
            }
          });
        }
      }

      if (isFunctionLike(node)) {
        for (const param of node.parameters) {
          const typeText = param.type ? param.type.getText(sf) : "";
          const names: string[] = [];
          if (ts.isIdentifier(param.name)) names.push(param.name.text);
          else if (ts.isObjectBindingPattern(param.name)) {
            for (const el of param.name.elements) if (ts.isIdentifier(el.name)) names.push(el.name.text);
          }
          for (const name of names) {
            if (!TRANSLATOR_PARAM.test(name)) {
              bind(node, name, "shadow");
              continue;
            }
            const own = ts.isIdentifier(param.name)
              ? typeText
              : (typeText.match(new RegExp(`\\b${name}\\??\\s*:\\s*([^;,}]+(?:<[^>]*>)*[^;,}]*)`)) ?? [])[1] ?? "";
            const typed = own.match(/(?:useTranslations|getTranslations)<\s*['"]([^'"]+)['"]\s*>/);
            bind(node, name, { namespaces: typed ? [typed[1]] : null });
          }
        }
      }

      if (ts.isCallExpression(node)) {
        let target: ts.Identifier | null = null;
        let method: Ref["method"] = "call";
        if (ts.isIdentifier(node.expression)) target = node.expression;
        else if (
          ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          METHODS.has(node.expression.name.text)
        ) {
          target = node.expression.expression;
          method = node.expression.name.text as Ref["method"];
        }
        if (target && node.arguments[0]) callSites.push({ node, target, method });
      }

      if (ts.isPropertyAccessExpression(node) && !ts.isPropertyAccessExpression(node.parent)) {
        const names: string[] = [];
        let n: ts.Expression = node;
        while (ts.isPropertyAccessExpression(n)) {
          names.unshift(n.name.text);
          n = unwrap(n.expression);
        }
        if (ts.isIdentifier(n)) names.unshift(n.text);
        else if (ts.isConditionalExpression(n)) names.unshift("?");
        chains.push(names);
      }

      ts.forEachChild(node, visit);
    };
    const callSites: { node: ts.CallExpression; target: ts.Identifier; method: Ref["method"] }[] = [];
    const chains: string[][] = [];
    visit(sf);

    // Los namespaces literales del archivo no son candidatos de uno dinámico.
    const literalNs = new Set(
      pending.flatMap((p) => {
        const a = p.arg ? unwrap(p.arg) : undefined;
        if (a && stringOf(a) !== null) return [stringOf(a)!];
        if (a && ts.isObjectLiteralExpression(a)) {
          const pr = a.properties.find((x) => ts.isPropertyAssignment(x) && x.name.getText(sf) === "namespace");
          const v = pr && ts.isPropertyAssignment(pr) ? stringOf(pr.initializer) : null;
          return v !== null ? [v] : [];
        }
        return [];
      }),
    );
    const dynamicNamespaces = () => fileNamespaces().filter((ns) => !literalNs.has(ns));

    for (const p of pending) {
      let namespaces: string[] | null;
      let literal = true;
      const arg = p.arg ? unwrap(p.arg) : undefined;
      if (!arg) namespaces = [""];
      else if (stringOf(arg) !== null) namespaces = [stringOf(arg)!];
      else if (ts.isObjectLiteralExpression(arg)) {
        const prop = arg.properties.find(
          (pr) => ts.isPropertyAssignment(pr) && pr.name.getText(sf) === "namespace",
        ) as ts.PropertyAssignment | undefined;
        if (!prop) namespaces = [""];
        else if (stringOf(prop.initializer) !== null) namespaces = [stringOf(prop.initializer)!];
        else {
          literal = false;
          namespaces = dynamicNamespaces();
        }
      } else {
        literal = false;
        namespaces = dynamicNamespaces();
      }
      if (namespaces && namespaces.length === 0) namespaces = null;
      bind(p.scope, p.name, { namespaces });
      out.factories.push({ file: rel, line: line(p.node), namespaces, literal });
    }

    const lookup = (from: ts.Node, name: string): Binding | undefined => {
      let n: ts.Node | undefined = from;
      while (n) {
        if (isFunctionLike(n) || ts.isSourceFile(n)) {
          const b = scopes.get(n)?.get(name);
          if (b) return b;
        }
        n = n.parent;
      }
      return undefined;
    };

    for (const site of callSites) {
      const b = lookup(site.node, site.target.text);
      if (!b || b === "shadow") continue;
      const second = site.node.arguments[1] ? unwrap(site.node.arguments[1]) : undefined;
      let values: string[] | null = [];
      if (second && ts.isObjectLiteralExpression(second)) {
        values = [];
        for (const pr of second.properties) {
          if ((ts.isPropertyAssignment(pr) || ts.isShorthandPropertyAssignment(pr) || ts.isMethodDeclaration(pr)) && pr.name) values.push(pr.name.getText(sf).replace(/^['"]|['"]$/g, ""));
          else values = null;
          if (values === null) break;
        }
      } else if (second) values = null;
      for (const arg of keyArgs(site.node.arguments[0])) {
        out.refs.push({ file: rel, line: line(site.node), method: site.method, namespaces: b.namespaces, arg, values });
      }
    }

    if (jsonIdents.size || /messages\/(es|en)\.json|\b(getMessages|useMessages)\(/.test(text)) {
      for (const names of chains) out.jsonChains.push({ file: rel, names });
    }
    out.literals.set(file, literals);
    out.imports.set(file, imports);
  }
  return out;
}

/** Literales del archivo y de lo que importa directamente (listas de claves en otro módulo). */
export function literalsAround(s: Scan, relFile: string): Set<string> {
  const abs = path.join(ROOT, relFile);
  const all = new Set(s.literals.get(abs) ?? []);
  for (const dep of s.imports.get(abs) ?? []) for (const l of Array.from(s.literals.get(dep) ?? [])) all.add(l);
  return all;
}

export const join = (ns: string, key: string) => (ns ? `${ns}.${key}` : key);
