/**
 * @vitest-environment node
 *
 * Tests unitarios — toda clase de color con opacidad (`bg-x/80`) genera regla.
 *
 * Los colores del tema eran `var(--x)` a secas, y Tailwind 3 no sabe aplicar
 * un canal alfa a una variable: `bg-surface/80`, `border-accent-danger/30` o
 * `ring-accent-pink/40` se quedaban SIN regla. No era solo "sin estilo": el
 * preflight dejaba los bordes en gris claro (#e5e7eb) y los anillos en el azul
 * por defecto de Tailwind. La cabecera pública era transparente por eso.
 *
 * Este test compila Tailwind con el `tailwind.config.ts` del repo y comprueba
 * dos cosas:
 * 1. las 17 clases concretas que estaban muertas generan regla;
 * 2. cualquier clase `<utilidad>-<color del tema>/<alfa>` que aparezca en
 *    `src` genera regla (red de seguridad para que no vuelva a pasar).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join, resolve } from "path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import config from "../../../tailwind.config";

const ROOT = resolve(__dirname, "../../..");
const SRC = join(ROOT, "src");

/** Las 17 clases distintas con alfa que no generaban regla (auditoría). */
const PREVIOUSLY_DEAD = [
  "bg-accent-positive/20",
  "bg-accent-positive/15",
  "border-accent-positive/60",
  "ring-accent-pink/40",
  "bg-accent-info/20",
  "bg-accent-highlight/20",
  "bg-accent-danger/20",
  "border-accent-danger/30",
  "border-accent-danger/60",
  "bg-surface-base/80",
  "text-accent-info/80",
  "bg-surface/80",
  "border-border/40",
  "bg-accent-danger/10",
  "bg-accent-positive/10",
  "border-accent-positive/30",
  "border-accent-danger/50",
];

const COLOR_UTILITIES = [
  "bg", "text", "border", "border-t", "border-b", "border-l", "border-r",
  "ring", "ring-offset", "outline", "divide", "from", "via", "to",
  "shadow", "fill", "stroke", "placeholder", "decoration", "caret", "accent",
];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(tsx?|mdx?)$/.test(entry.name) ? [full] : [];
  });
}

/** Nombre de clase → selector escapado tal como lo emite Tailwind. */
function escapeClass(cls: string): string {
  return cls.replace(/[/:.[\]%#()]/g, (c) => `\\${c}`);
}

let css = "";
let themeColors: string[] = [];

beforeAll(async () => {
  const sourceClasses = [...PREVIOUSLY_DEAD, "border-stroke"].join(" ");
  const result = await postcss([
    tailwindcss({
      ...config,
      // El contenido real del repo + las clases de la lista fija, para que el
      // test no dependa de que hoy alguien las siga usando.
      content: [
        ...(config.content as string[]).map((p) => join(ROOT, p)),
        { raw: sourceClasses, extension: "html" },
      ],
    }),
  ]).process("@tailwind utilities;", { from: undefined });
  css = result.css;
  themeColors = Object.keys(
    (config.theme?.extend?.colors ?? {}) as Record<string, unknown>
  );
}, 60_000);

describe("DIS-1 — los colores del tema admiten modificador de opacidad", () => {
  it.each(PREVIOUSLY_DEAD)("%s genera regla", (cls) => {
    expect(css).toContain(`.${escapeClass(cls)}`);
  });

  it("la opacidad se aplica de verdad (color-mix con el porcentaje)", () => {
    const rule = css.split(`.${escapeClass("bg-surface/80")}`)[1]?.split("}")[0] ?? "";
    expect(rule).toMatch(/color-mix\(in oklch, var\(--surface-default\) calc\(0\.8 \* 100%\), transparent\)/);
  });

  it("toda clase <utilidad>-<color del tema>/<alfa> usada en src genera regla", () => {
    const colorAlt = [...themeColors].sort((a, b) => b.length - a.length).map((c) => c.replace(/[-]/g, "\\-")).join("|");
    const utilAlt = [...COLOR_UTILITIES].sort((a, b) => b.length - a.length).map((u) => u.replace(/[-]/g, "\\-")).join("|");
    const re = new RegExp(
      `(?<![\\w-])((?:[a-z0-9-]+:)*)(?:${utilAlt})-(?:${colorAlt})\\/(?:\\d{1,3}|\\[[^\\]\\s]+\\])(?![\\w-])`,
      "g"
    );
    const used = new Set<string>();
    for (const file of walk(SRC)) {
      for (const m of Array.from(readFileSync(file, "utf8").matchAll(re))) used.add(m[0]);
    }
    expect(used.size).toBeGreaterThan(10);
    const missing = Array.from(used).filter((cls) => !css.includes(`.${escapeClass(cls)}`));
    expect(missing).toEqual([]);
  });

  it("border-stroke (nombre del canvas, usado en /best) genera regla con el token del borde", () => {
    // Sin la clave `stroke` en el tema, la clase no existía y el botón
    // "Ver más" de los rankings salía con el gris #e5e7eb del preflight.
    const rule = css.split(`.${escapeClass("border-stroke")} {`)[1]?.split("}")[0] ?? "";
    expect(rule).toContain("var(--surface-border)");
  });

  it("text-accent-danger usa el rojo de texto accesible", () => {
    const rule = css.split(`.${escapeClass("text-accent-danger")} {`)[1]?.split("}")[0] ?? "";
    expect(rule).toContain("var(--accent-danger-text)");
  });
});
