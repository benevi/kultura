/**
 * @vitest-environment node
 *
 * Fase 8.4 — tokens de «Sala» (`src/lib/design/sala-tokens.ts`).
 *
 * - Que `src/styles/sala/tokens.css` es lo que genera `salaTokensCss()` lo
 *   comprueba `sala-tokens-css.test.ts`. Aquí se lee el CSS ya escrito.
 * - El contraste se mide sobre lo que hay ESCRITO en el CSS, tema a tema:
 *   4,5:1 para texto y 3:1 para componentes (WCAG 2.2 AA), estados incluidos.
 * - Una obra: su paleta llega al contenedor `sala-work` por variables y el CSS
 *   elige el tema; los estados, que no cambian con la obra, siguen cumpliendo
 *   sobre cualquier fondo de obra. Que la paleta de una imagen cumple AA por
 *   dentro ya lo prueba `image-palette.test.ts` con 3000 portadas.
 * - Tailwind: cada token tiene su clase y ninguna clase apunta a una variable
 *   que el CSS no define.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import config from "../../../tailwind.config";
import { contrastRatio, parseHex, type Rgb } from "@/lib/design/color";
import {
  COMPONENT_CONTRAST,
  NEUTRAL_BASE,
  NEUTRAL_PALETTE,
  paletteFromPixels,
  paletteFromSwatches,
  TEXT_CONTRAST,
  type ImagePalette,
  type Swatch,
} from "@/lib/design/image-palette";
import { SALA_MODES, SALA_ROLES, SALA_WORK_CLASS, salaVar, workPaletteVars, type SalaMode } from "@/lib/design/sala-palette";
import {
  SALA_COLOR,
  SALA_COLOR_ALIAS,
  SALA_COLOR_NAMES,
  SALA_STATES,
  SALA_TYPE,
  salaTokensCss,
} from "@/lib/design/sala-tokens";

const ROOT = resolve(__dirname, "../../..");
const CSS_PATH = resolve(ROOT, "src/styles/sala/tokens.css");
const CSS = readFileSync(CSS_PATH, "utf8");

// ------------------------------------------------------------
// Lector mínimo del CSS generado (sin depender del generador)
// ------------------------------------------------------------

type Vars = Record<string, string>;

/** Declaraciones `--x: valor;` del bloque cuyo selector es exactamente `selector`. */
function block(css: string, selector: string): Vars {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of Array.from(clean.matchAll(/([^{}]+)\{([^{}]*)\}/g))) {
    const selectors = m[1].split(",").map((s) => s.trim());
    if (!selectors.includes(selector)) continue;
    return Object.fromEntries(Array.from(m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]*);/g), (d) => [d[1], d[2].trim()]));
  }
  throw new Error(`tokens.css sin bloque ${selector}`);
}

/**
 * Sustituye los `var(--x, respaldo)` como lo hace el navegador. Una variable
 * sin definir o con `initial` no vale y deja pasar el respaldo; una vacía vale
 * y no deja nada.
 */
function substitute(value: string, env: Vars): string {
  let out = "";
  for (let i = 0; i < value.length; ) {
    if (!value.startsWith("var(", i)) {
      out += value[i++];
      continue;
    }
    let depth = 0;
    let end = i + 3;
    for (; end < value.length; end++) {
      if (value[end] === "(") depth++;
      else if (value[end] === ")" && --depth === 0) break;
    }
    const inner = value.slice(i + 4, end);
    const comma = inner.indexOf(",");
    const name = (comma < 0 ? inner : inner.slice(0, comma)).trim();
    const fallback = comma < 0 ? undefined : inner.slice(comma + 1);
    const own = env[name];
    if (own !== undefined && own !== "initial") out += substitute(own, env);
    else if (fallback !== undefined) out += substitute(fallback, env);
    else throw new Error(`${name} sin valor ni respaldo`);
    i = end + 1;
  }
  return out.trim();
}

const THEME_SELECTOR: Record<SalaMode, string> = { light: '[data-theme="light"]', dark: '[data-theme="dark"]' };
const THEME: Record<SalaMode, Vars> = { light: block(CSS, THEME_SELECTOR.light), dark: block(CSS, THEME_SELECTOR.dark) };
const WORK = block(CSS, `.${SALA_WORK_CLASS}`);

/** Variables que ve un elemento dentro de un contenedor de obra con ese `style`, en ese tema. */
function insideWork(mode: SalaMode, style: Vars): Vars {
  // En orden, como están escritas: primero los papeles y después los alias, que los leen.
  const resolved: Vars = { ...THEME[mode], ...style };
  for (const name of Object.keys(WORK)) resolved[name] = substitute(WORK[name], resolved);
  return resolved;
}

function rgb(env: Vars, token: string): Rgb {
  const value = substitute(`var(${salaVar(token)})`, env);
  const out = parseHex(value);
  if (!out) throw new Error(`${salaVar(token)} = «${value}» no es un color`);
  return out;
}

/** Los pares que tienen que cumplir, sobre un juego de variables ya resuelto. */
const PAIRS: Array<{ fg: string; bg: string; min: number }> = [
  ...["background", "panel"].flatMap((bg) => [
    { fg: "ink", bg, min: TEXT_CONTRAST },
    { fg: "inkSecondary", bg, min: TEXT_CONTRAST },
    { fg: "accent", bg, min: TEXT_CONTRAST },
    ...SALA_STATES.map((state) => ({ fg: state, bg, min: TEXT_CONTRAST })),
    { fg: "border", bg, min: COMPONENT_CONTRAST },
    { fg: "focus", bg, min: COMPONENT_CONTRAST },
    { fg: "inkDisabled", bg, min: COMPONENT_CONTRAST },
  ]),
  { fg: "accentInk", bg: "accent", min: TEXT_CONTRAST },
  { fg: "bandInk", bg: "band", min: TEXT_CONTRAST },
  ...SALA_STATES.map((state) => ({ fg: `${state}Ink`, bg: state, min: TEXT_CONTRAST })),
];

function failures(env: Vars, pairs = PAIRS): string[] {
  return pairs
    .map(({ fg, bg, min }) => ({ fg, bg, min, ratio: contrastRatio(rgb(env, fg), rgb(env, bg)) }))
    .filter((p) => p.ratio < p.min)
    .map((p) => `${p.fg} sobre ${p.bg}: ${p.ratio.toFixed(2)} < ${p.min}`);
}

// ------------------------------------------------------------

describe("tokens.css", () => {
  it.each(SALA_MODES)("tema %s: los nueve papeles son los neutros de NEUTRAL_PALETTE", (mode) => {
    for (const role of SALA_ROLES) expect(THEME[mode][salaVar(role)], role).toBe(NEUTRAL_PALETTE[mode][role]);
  });

  it("fondo y tinta neutros son los de la biblia (§4)", () => {
    for (const mode of SALA_MODES) {
      expect(THEME[mode][salaVar("background")]).toBe(NEUTRAL_BASE[mode].background);
      expect(THEME[mode][salaVar("ink")]).toBe(NEUTRAL_BASE[mode].ink);
    }
  });

  it("sin data-theme vale el oscuro (la app de hoy) y el claro va después en la hoja", () => {
    expect(CSS).toMatch(/:root,\s*\[data-theme="dark"\]\s*\{/);
    expect(CSS.indexOf(THEME_SELECTOR.light)).toBeGreaterThan(CSS.indexOf(THEME_SELECTOR.dark));
    expect(CSS).not.toContain("prefers-color-scheme");
  });

  it("cada tema define los mismos tokens y todos los nombres de color", () => {
    expect(Object.keys(THEME.light).sort()).toEqual(Object.keys(THEME.dark).sort());
    for (const name of SALA_COLOR_NAMES) expect(THEME.light).toHaveProperty(salaVar(name));
  });

  it("los alias apuntan a un token con valor propio", () => {
    for (const [name, target] of Object.entries(SALA_COLOR_ALIAS)) {
      expect(SALA_COLOR.light).toHaveProperty(target);
      expect(THEME.light[salaVar(name)]).toBe(`var(${salaVar(target)})`);
    }
  });

  it("con followSystem, sin data-theme manda el sistema y los valores de claro son los mismos", () => {
    const css = salaTokensCss({ followSystem: true });
    const media = /@media \(prefers-color-scheme: light\) \{([\s\S]*?\n {2}\})\n\}/.exec(css);
    expect(media).not.toBeNull();
    expect(block(media![1], ":root:not([data-theme])")).toEqual(THEME.light);
    // Quitando ese bloque, es la hoja de hoy.
    expect(css.replace(/\n\/\* Sin data-theme manda el sistema\. \*\/\n@media[\s\S]*?\n\}\n/, "")).toBe(salaTokensCss());
  });
});

describe("contraste AA de los tokens neutros", () => {
  describe.each(SALA_MODES)("tema %s", (mode) => {
    it.each(PAIRS)("$fg sobre $bg ≥ $min:1", ({ fg, bg, min }) => {
      expect(contrastRatio(rgb(THEME[mode], fg), rgb(THEME[mode], bg))).toBeGreaterThanOrEqual(min);
    });
  });

  it("claro y oscuro no son el mismo tema", () => {
    expect(THEME.light[salaVar("background")]).not.toBe(THEME.dark[salaVar("background")]);
    for (const state of SALA_STATES) expect(THEME.light[salaVar(state)]).not.toBe(THEME.dark[salaVar(state)]);
  });
});

describe("la paleta de una obra en su contenedor", () => {
  /** Un color cualquiera como única mancha de una portada. */
  const single = (l: number, c: number, h: number): Swatch => ({ rgb: [0, 0, 0], oklch: { l, c, h }, share: 1 });
  const VIVID = paletteFromSwatches([single(0.6, 0.2, 265)]);

  it("workPaletteVars da los nueve papeles de los dos temas", () => {
    const vars = workPaletteVars(VIVID);
    expect(Object.keys(vars)).toHaveLength(SALA_ROLES.length * 2);
    expect(vars["--sala-work-light-band"]).toBe(VIVID.light.band);
    expect(vars["--sala-work-dark-ink-secondary"]).toBe(VIVID.dark.inkSecondary);
    // Todas las variables que da son las que el CSS espera.
    for (const name of Object.keys(vars)) expect(Object.values(WORK).join(" ")).toContain(`var(${name},`);
  });

  it.each(SALA_MODES)("tema %s: dentro del contenedor cada papel es el de la obra", (mode) => {
    expect(VIVID.neutral).toBe(false);
    const env = insideWork(mode, workPaletteVars(VIVID));
    for (const role of SALA_ROLES) expect(env[salaVar(role)], role).toBe(VIVID[mode][role]);
    // Los alias siguen a la obra.
    expect(rgb(env, "focus")).toEqual(parseHex(VIVID[mode].ink));
    expect(rgb(env, "inkDisabled")).toEqual(parseHex(VIVID[mode].border));
  });

  it.each(SALA_MODES)("tema %s: sin paleta todavía, el contenedor se queda en los neutros", (mode) => {
    const env = insideWork(mode, {});
    for (const role of SALA_ROLES) expect(env[salaVar(role)], role).toBe(NEUTRAL_PALETTE[mode][role]);
  });

  it("los estados y el foco cumplen sobre el fondo y el panel de cualquier obra", () => {
    const palettes: ImagePalette[] = [];
    // Barrido: todos los matices, de casi gris a saturado, oscuros y claros.
    for (let h = 0; h < 360; h += 2) {
      for (const c of [0.02, 0.06, 0.1, 0.2, 0.35]) {
        for (const l of [0.3, 0.6, 0.9]) palettes.push(paletteFromSwatches([single(l, c, h)]));
      }
    }
    // Y portadas al azar, con semilla (mulberry32): las mismas en cada ejecución.
    let a = 8.4e6;
    const rnd = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = 0; i < 300; i++) {
      const blobs = Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => [rnd() * 255, rnd() * 255, rnd() * 255]);
      const pixels: number[] = [];
      for (let p = 0; p < 256; p++) pixels.push(...blobs[Math.floor(rnd() * blobs.length)], 255);
      palettes.push(paletteFromPixels(pixels));
    }

    const bad: string[] = [];
    for (const palette of palettes) {
      for (const mode of SALA_MODES) {
        const fails = failures(insideWork(mode, workPaletteVars(palette)));
        if (fails.length) bad.push(`${mode} ${palette[mode].background}: ${fails.join("; ")}`);
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
    expect(palettes.some((p) => !p.neutral)).toBe(true);
  });
});

describe("Tailwind expone los tokens", () => {
  const COLOR_CLASSES = SALA_COLOR_NAMES.flatMap((name) => {
    const key = salaVar(name).slice(2);
    return [`bg-${key}`, `text-${key}`, `border-${key}`];
  });
  const OTHER_CLASSES = [
    "bg-sala-background/80",
    "font-sala-display",
    "font-sala-text",
    "min-h-sala-target",
    "px-sala-margin",
    "duration-sala-fast",
    "duration-sala-slow",
    "ease-sala",
    "sala-focus",
    "focus-visible:sala-focus",
    ...Object.keys(SALA_TYPE).map((role) => `sala-type-${role}`),
  ];
  let css = "";

  beforeAll(async () => {
    const result = await postcss([
      tailwindcss({ ...config, content: [{ raw: [...COLOR_CLASSES, ...OTHER_CLASSES].join(" "), extension: "html" }] }),
    ]).process("@tailwind components; @tailwind utilities;", { from: undefined });
    css = result.css;
  }, 60_000);

  it.each([...COLOR_CLASSES, ...OTHER_CLASSES])("%s genera regla", (cls) => {
    expect(css).toContain(`.${cls.replace(/[/:]/g, (c) => `\\${c}`)}`);
  });

  it("ninguna clase usa una variable --sala-* que tokens.css no defina", () => {
    const defined = new Set([...Object.keys(block(CSS, ":root")), ...Object.keys(THEME.light)]);
    const used = new Set(Array.from(css.matchAll(/var\((--sala-[\w-]+)/g), (m) => m[1]));
    expect(used.size).toBeGreaterThan(SALA_COLOR_NAMES.length);
    expect(Array.from(used).filter((name) => !defined.has(name))).toEqual([]);
  });

  it("las clases de hoy siguen igual: los tokens nuevos solo añaden nombres con «sala»", () => {
    const colors = (config.theme?.extend?.colors ?? {}) as Record<string, string>;
    expect(colors["surface-base"]).toContain("var(--surface-base)");
    expect(colors["text-primary"]).toContain("var(--text-primary)");
    const fonts = (config.theme?.extend?.fontFamily ?? {}) as Record<string, string[]>;
    expect(fonts.display[0]).toBe("var(--font-display)");
    expect(fonts.body[0]).toBe("var(--font-body)");
    for (const key of Object.keys(colors).filter((k) => /sala/.test(k))) expect(key.startsWith("sala-")).toBe(true);
  });
});

describe("la app de hoy no carga nada de «Sala»", () => {
  it("globals.css no define ni importa tokens de Sala", () => {
    const globals = readFileSync(resolve(ROOT, "src/app/globals.css"), "utf8");
    expect(globals).not.toMatch(/--sala-|styles\/sala|@import/);
  });

  it("las fuentes que carga la app siguen siendo las suyas", () => {
    const fonts = readFileSync(resolve(ROOT, "src/app/fonts/index.ts"), "utf8");
    expect(fonts).not.toMatch(/assets\/fonts|Anybody|Instrument|Noto/);
  });
});
