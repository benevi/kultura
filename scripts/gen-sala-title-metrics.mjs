#!/usr/bin/env node
// Mide Anybody (el rótulo de «Sala») y escribe src/lib/design/sala-title-metrics.ts:
//
// - el avance de cada carácter a peso 800 en tres puntos del eje de anchura
//   (50, 100 y 150 %); entre ellos el avance es lineal, y el script se para
//   si no lo es;
// - el ascendente y el descendente de la fuente;
// - cuánto hay que encoger o estirar la fuente de respaldo (Arial Bold) en
//   cada tramo de anchura para que nunca salga más ancha que Anybody.
//
// Con eso el servidor sabe cuánto mide un título sin pintarlo
// (src/lib/design/sala-title.ts) y la hoja del rótulo declara su respaldo
// (src/lib/design/sala-title-css.ts).
//
// Uso: node scripts/gen-sala-title-metrics.mjs
// Necesita el Chromium de Playwright (`npx playwright install chromium`) y una
// máquina con Arial (Windows o macOS; Liberation Sans y Arimo miden lo mismo).
// Hay que volver a lanzarlo si cambian los archivos de assets/fonts/anybody/.
import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FONT_DIR = join(ROOT, "assets/fonts/anybody");
const OUT = join(ROOT, "src/lib/design/sala-title-metrics.ts");
const FILES = ["Anybody-latin-wdth-wght.woff2", "Anybody-latin-ext-wdth-wght.woff2"];
const WEIGHT = 800;
/** Tramos del eje de anchura para la fuente de respaldo: [desde, hasta], en %. */
const BUCKETS = Array.from({ length: 20 }, (_, i) => [50 + i * 5, i === 19 ? 150 : 54 + i * 5]);

// Los rangos de cada archivo salen de la hoja ya generada: una sola fuente de verdad.
const sheet = readFileSync(join(ROOT, "src/styles/sala/fonts.css"), "utf8");
const ranges = [];
for (const block of sheet.split("@font-face").slice(1)) {
  if (!/font-family:\s*"Anybody"/.test(block)) continue;
  const value = /unicode-range:\s*([^;]+);/.exec(block)?.[1];
  if (!value) throw new Error("Una regla de Anybody sin unicode-range");
  for (const part of value.split(",")) {
    const m = /^U\+([0-9a-f]+)(?:-([0-9a-f]+))?$/i.exec(part.trim());
    if (!m) throw new Error(`unicode-range ilegible: ${part}`);
    ranges.push([parseInt(m[1], 16), parseInt(m[2] ?? m[1], 16)]);
  }
}
const codepoints = [...new Set(ranges.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i)))].sort((a, b) => a - b);

// Títulos reales, cortos y largos, para medir el interletraje y el respaldo.
const CORPUS = [
  "Up", "It", "Her", "Roma", "Dune", "Akira", "Hades", "Coco", "Alien", "Seven", "Tenet", "Berserk", "Monster", "Watchmen",
  "Parásitos", "Parasite", "Vértigo", "Psicosis", "Amélie", "Oldboy", "Memento", "Origen", "Gladiator", "Interstellar",
  "Breaking Bad", "Elden Ring", "The Wire", "Mad Men", "Twin Peaks", "Dark Souls", "Hollow Knight", "Blade Runner",
  "El padrino", "Pulp Fiction", "Taxi Driver", "La La Land", "Death Note", "One Piece", "Slam Dunk", "Vinland Saga",
  "El viaje de Chihiro", "Spirited Away", "La princesa Mononoke", "Mi vecino Totoro", "El castillo ambulante",
  "Cien años de soledad", "Crimen y castigo", "Don Quijote de la Mancha", "Rayuela", "Pedro Páramo", "La Regenta",
  "El señor de los anillos", "Juego de tronos", "Los Soprano", "La casa de papel", "Stranger Things", "Better Call Saul",
  "Fullmetal Alchemist: Brotherhood", "Neon Genesis Evangelion", "Cowboy Bebop", "Attack on Titan", "Ataque a los titanes",
  "The Legend of Zelda: Breath of the Wild", "Red Dead Redemption 2", "The Last of Us Parte II", "Baldur's Gate 3",
  "El bueno, el feo y el malo", "2001: Una odisea del espacio", "Apocalypse Now", "Ciudadano Kane", "Casablanca",
  "Eternal Sunshine of the Spotless Mind", "¡Olvídate de mí!", "¿Quién engañó a Roger Rabbit?", "Los 400 golpes",
  "Dr. Strangelove or: How I Learned to Stop Worrying and Love the Bomb",
  "¿Teléfono rojo? Volamos hacia Moscú", "El extraño caso del Dr. Jekyll y Mr. Hyde", "LAWRENCE DE ARABIA", "AVATAR",
  "WALL·E", "M*A*S*H", "8½", "12 hombres sin piedad", "1984", "Fahrenheit 451", "Yo, robot", "Guía del autoestopista galáctico",
  "Birdman o (La inesperada virtud de la ignorancia)", "El curioso incidente del perro a medianoche",
  "Todo a la vez en todas partes", "Everything Everywhere All at Once", "Mujeres al borde de un ataque de nervios",
  "To Wong Foo, Thanks for Everything! Julie Newmar", "La insoportable levedad del ser", "Ålesund", "Żywot człowieka", "Über uns",
  "Le fabuleux destin d'Amélie Poulain", "Crouching Tiger, Hidden Dragon", "The Good, the Bad and the Ugly", "Tokyo Story",
  "Supercalifragilisticoespialidoso", "Final Fantasy VII Rebirth", "Xenoblade Chronicles 3", "Chainsaw Man", "Jujutsu Kaisen",
];

const b64 = (file) => readFileSync(join(FONT_DIR, file)).toString("base64");
const rule = (file, block) =>
  `@font-face{font-family:"Anybody";font-weight:100 900;font-stretch:50% 150%;src:url(data:font/woff2;base64,${b64(file)}) format("woff2");unicode-range:${block};}`;
const blocks = sheet.split("@font-face").slice(1).filter((b) => /font-family:\s*"Anybody"/.test(b));
const css = FILES.map((file) => {
  const block = blocks.find((b) => b.includes(file));
  if (!block) throw new Error(`fonts.css no declara ${file}`);
  return rule(file, /unicode-range:\s*([^;]+);/.exec(block)[1]);
}).join("\n");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(`<style>${css}</style><span id="s"></span>`);
await page.evaluate(() => Promise.all([document.fonts.load('800 100px "Anybody"', "aÁ"), document.fonts.load('800 100px "Anybody"', "ąŻ")]));

const measured = await page.evaluate(
  ({ codepoints, WEIGHT, CORPUS, BUCKETS }) => {
    const span = document.getElementById("s");
    const SIZE = 1000;
    const width = (text, family, stretch, extra = "") => {
      span.style.cssText = `position:absolute;white-space:pre;font:${WEIGHT} ${SIZE}px ${family};font-stretch:${stretch}%;letter-spacing:0;${extra}`;
      span.textContent = text;
      return span.getBoundingClientRect().width;
    };
    // ¿Está Arial? Si no, `Arial` cae en la de respaldo y mide lo mismo que ella.
    const probe = "El viaje de Chihiro 0123";
    const arial = width(probe, "Arial, monospace", 100) !== width(probe, "monospace", 100) && width(probe, "Arial, serif", 100) !== width(probe, "serif", 100);

    const advances = [];
    let worstLinear = 0;
    for (const cp of codepoints) {
      // Los caracteres de control no se pintan.
      if (cp < 0x20 || (cp >= 0x7f && cp <= 0x9f)) continue;
      const ch = String.fromCodePoint(cp);
      const [lo, q1, mid, q3, hi] = [50, 75, 100, 125, 150].map((s) => width(ch, '"Anybody"', s));
      // Sin glifo en Anybody, el carácter sale de una fuente del sistema, que no tiene eje de anchura:
      // mide lo mismo a 50 que a 150 %. Los de Anybody crecen todos (hasta el punto y el espacio).
      if (!(hi > lo * 1.05 && mid > lo && hi > mid)) continue;
      worstLinear = Math.max(worstLinear, Math.abs(q1 - (lo + mid) / 2), Math.abs(q3 - (mid + hi) / 2));
      advances.push([cp, Math.round(lo), Math.round(mid), Math.round(hi)]);
    }
    const canvas = document.createElement("canvas").getContext("2d");
    canvas.font = `${WEIGHT} ${SIZE}px "Anybody"`;
    const box = canvas.measureText("Hg");

    // Interletraje: lo pintado frente a la suma de avances, en los títulos del corpus.
    const byCp = new Map(advances.map(([cp, lo, mid, hi]) => [cp, [lo, mid, hi]]));
    const sum = (text, stretch) => {
      let total = 0;
      for (const ch of text) {
        const a = byCp.get(ch.codePointAt(0));
        if (!a) return NaN;
        total += stretch <= 100 ? a[0] + ((a[1] - a[0]) * (stretch - 50)) / 50 : a[1] + ((a[2] - a[1]) * (stretch - 100)) / 50;
      }
      return total;
    };
    let kernMax = -Infinity;
    let kernMin = Infinity;
    for (const title of CORPUS) {
      for (const stretch of [50, 75, 100, 125, 150]) {
        const flat = sum(title, stretch);
        if (!Number.isFinite(flat)) continue;
        const gain = (width(title, '"Anybody"', stretch) - flat) / flat;
        kernMax = Math.max(kernMax, gain);
        kernMin = Math.min(kernMin, gain);
      }
    }

    // Respaldo: Arial Bold frente a Anybody en el extremo estrecho de cada tramo.
    const fallback = BUCKETS.map(([from, to]) => {
      const ratios = [];
      for (const title of CORPUS) {
        const flat = sum(title, from);
        if (Number.isFinite(flat)) ratios.push([flat / width(title, "Arial", 100), title]);
      }
      ratios.sort((a, b) => a[0] - b[0]);
      return { from, to, min: ratios[0][0], worst: ratios[0][1], mean: ratios.reduce((a, r) => a + r[0], 0) / ratios.length, p10: ratios[Math.floor(ratios.length / 10)][0] };
    });
    return { arial, advances, worstLinear, ascent: box.fontBoundingBoxAscent / SIZE, descent: box.fontBoundingBoxDescent / SIZE, kernMax, kernMin, fallback };
  },
  { codepoints, WEIGHT, CORPUS, BUCKETS },
);
await browser.close();

if (!measured.arial) throw new Error("Esta máquina no tiene Arial: el respaldo no se puede medir.");
if (measured.worstLinear > 3) throw new Error(`El avance no es lineal entre 50, 100 y 150 % (${measured.worstLinear} milésimas de em)`);
if (measured.kernMax > 0.001) throw new Error(`El interletraje ensancha algún título (${measured.kernMax}): la suma de avances ya no es un tope`);

const FALLBACK_RANGE = "U+0020-007E,U+00A0-00AC,U+00AE-0148,U+014A-017E,U+2013-2014,U+2018-201A,U+201C-201E,U+2026,U+2039-203A,U+20AC";
const measuredSet = new Set(measured.advances.map(([cp]) => cp));
for (const part of FALLBACK_RANGE.split(",")) {
  const [a, b = a] = part.slice(2).split("-").map((n) => parseInt(n, 16));
  for (let cp = a; cp <= b; cp++) if (!measuredSet.has(cp)) throw new Error(`El respaldo cubre U+${cp.toString(16)}, que Anybody no tiene`);
}
const hash = createHash("sha256");
for (const file of FILES) hash.update(readFileSync(join(FONT_DIR, file)));
const round = (n, d = 3) => Number(n.toFixed(d));
// El respaldo, un 1 % por debajo del peor título medido: nunca más ancho que Anybody.
const fallback = measured.fallback.map(({ from, to, min, mean }) => ({ from, to, sizeAdjust: round(min * 0.99), mean: round(mean) }));
console.table(measured.fallback);
const raw = measured.advances.map((entry) => entry.map((n) => n.toString(36)).join(":")).join(" ");

writeFileSync(
  OUT,
  `// GENERADO por scripts/gen-sala-title-metrics.mjs. No editar.
// Anybody a peso ${WEIGHT}, medida en Chromium sobre los archivos de assets/fonts/anybody/.

/** Huella de los archivos medidos: si cambian, hay que volver a generar (lo comprueba el test). */
export const SALA_TITLE_FONT_SHA256 = '${hash.digest("hex")}'

/** Peso al que se midió: el del papel \`title\` de los tokens. */
export const SALA_TITLE_WEIGHT = ${WEIGHT}

/** Ascendente y descendente de Anybody, en em. */
export const SALA_TITLE_ASCENT = ${round(measured.ascent)}
export const SALA_TITLE_DESCENT = ${round(measured.descent)}

/**
 * Para qué caracteres vale la fuente de respaldo: el alfabeto latino con sus
 * acentos y la puntuación de un título, todos medidos en Anybody. Un carácter
 * de fuera cae en el resto de la pila, sin ajuste.
 */
export const SALA_TITLE_FALLBACK_RANGE = '${FALLBACK_RANGE}'

/**
 * Interletraje (kerning) en ${CORPUS.length} títulos reales: lo pintado frente a la suma de
 * avances. Nunca ensancha (máximo ${round(measured.kernMax * 100, 2)} %) y estrecha hasta un ${round(-measured.kernMin * 100, 1)} %.
 * Por eso la suma de avances es un tope del ancho de una línea.
 */
export const SALA_TITLE_KERNING = { max: ${round(measured.kernMax, 4)}, min: ${round(measured.kernMin, 4)} } as const

/**
 * Fuente de respaldo (Arial Bold y sus equivalentes) por tramo del eje de
 * anchura: \`sizeAdjust\` es cuánto se escala para que el título más
 * desfavorable del corpus mida un 1 % menos que con Anybody en el extremo
 * estrecho del tramo; \`mean\`, lo que mide de media (1 = igual que Anybody).
 */
export const SALA_TITLE_FALLBACK: ReadonlyArray<{ from: number; to: number; sizeAdjust: number; mean: number }> = [
${fallback.map((f) => `  { from: ${f.from}, to: ${f.to}, sizeAdjust: ${f.sizeAdjust}, mean: ${f.mean} },`).join("\n")}
]

/**
 * Avance de cada carácter, en milésimas de em: \`código:a50:a100:a150\`, en
 * base 36. Entre esos tres puntos del eje de anchura el avance es lineal
 * (error máximo medido a 75 y 125 %: ${round(measured.worstLinear, 2)} milésimas).
 */
export const SALA_TITLE_ADVANCES_RAW =
  '${raw}'
`,
);
console.log(`${OUT}: ${measured.advances.length} caracteres; interletraje ${measured.kernMin.toFixed(4)}…${measured.kernMax.toFixed(4)}`);
console.table(fallback);
