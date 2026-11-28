// ============================================================
// KULTURA — Logo de «Sala» (fase 8.5, M1). Dirección D1 «Bloque», elegida por
// Víctor el 28-11-2026 desde el logo B de las style tiles (D-F2d).
//
// El símbolo es un bloque con chaflán abajo a la izquierda y una K calada,
// dibujada a mano (un polígono, asta 26 de 100). La palabra «KULTURA» son los
// trazados de Anybody 800 · anchura 100 % (BIBLIA §5), con el espaciado y el
// interletraje que les da Chromium a 122 px con −0,025 em, centrada en alto
// con el bloque. Se sacaron una vez con fontTools (instancia de la variable y
// SVGPathPen); no hace falta repetirlo salvo que cambie el dibujo.
//
// Todo va en trazados: no depende de ninguna fuente, así sirve igual en la
// cabecera, en el favicon y en las tarjetas de next/og (que no leen fuentes
// variables). Un solo color, la tinta del tema; el acento de una obra solo se
// usa dentro de su ficha (decisión de Víctor, 28-11-2026).
//
// Los SVG de `public/brand/` salen de aquí: `npm run brand:sala` los reescribe
// y `tests/unit/design/sala-logo.test.ts` falla si no coinciden.
// ============================================================

import { SALA_COLOR } from "@/lib/design/sala-tokens";

/** Alto del símbolo y del logotipo, en unidades del viewBox. */
export const SALA_LOGO_HEIGHT = 100;
/** Ancho del logotipo (símbolo + palabra). */
export const SALA_LOGOTYPE_WIDTH = 673;

/** Bloque con chaflán y la K calada. Se pinta con `fill-rule="evenodd"`. */
export const SALA_SYMBOL_PATH =
  "m0 0h100v100h-72l-28-28zm28 22h14.6v21.3l16.8-21.3h17.9l-21.3 26.9 22.4 29.1h-17.9l-17.9-23.5v23.5h-14.6z";

/** «KULTURA» en Anybody 800, a la derecha del símbolo. Relleno normal (nonzero). */
export const SALA_WORD_PATH =
  "m132.7 91.2h24.5v-34.6l24 34.6h27.5l-29.2-41.1 29.1-41.2h-27.5l-23.9 34.6v-34.6h-24.5zm118.5.4q20 0 29.7-6.5 9.7-6.6 9.7-22.1v-54.1h-24.7v51.5q0 7.8-3.4 11.2-3.4 3.4-11.3 3.4-7.9 0-11.3-3.5-3.4-3.4-3.4-11.1v-51.5h-24.7v54.1q0 15.5 9.8 22.1 9.7 6.5 29.6 6.5zm46.8-.4h56.9v-16.6h-32.2v-65.7h-24.7zm69.9 0h24.7v-65.7h24.1v-16.6h-73v16.6h24.2zm94.2.4q20 0 29.7-6.5 9.7-6.6 9.7-22.1v-54.1h-24.7v51.5q0 7.8-3.4 11.2-3.4 3.4-11.3 3.4-7.9 0-11.3-3.5-3.4-3.4-3.4-11.1v-51.5h-24.7v54.1q0 15.5 9.7 22.1 9.7 6.5 29.7 6.5zm46.8-.4h24.7v-31.7h25q15 0 20.1-7.1 5.1-7.2 5.1-17.7 0-10.6-4.9-18.2-4.8-7.6-19.3-7.6h-50.7zm49.9 0h26.8l-20.3-39-24.5.9zm-25.2-46.7v-19h17.8q4.3 0 6 2.4 1.6 2.4 1.6 7.2 0 4.6-1.6 7-1.6 2.4-6 2.4zm53.2 46.7h25.4l4.9-18.7h25.7l4.8 18.7h25.3l-25.7-82.4h-34.7zm34.2-34.9 8.8-33.2h.3l8.8 33.2z";

/** Tinta del logo en cada tema: la de «Sala». */
export const SALA_LOGO_INK = { dark: SALA_COLOR.dark.ink, light: SALA_COLOR.light.ink } as const;
/** Fondo de los iconos de la app: el de «Sala» de noche. */
export const SALA_ICON_BACKGROUND = SALA_COLOR.dark.background;

/**
 * Lado del símbolo en los iconos de la app, en tanto por uno del lado del
 * icono. En el maskable cabe entero en la zona segura (círculo del 80 %): la
 * mitad de la diagonal, 0,52 × √2 / 2 ≈ 0,368, queda dentro del radio 0,4.
 */
export const SALA_ICON_SCALE = { any: 0.62, maskable: 0.52 } as const;

type Theme = "auto" | "dark" | "light";

/** Relleno: fijo, o la tinta del sistema (día por defecto, noche con `prefers-color-scheme: dark`). */
function fill(theme: Theme): { style: string; attr: string } {
  if (theme !== "auto") return { style: "", attr: ` fill="${SALA_LOGO_INK[theme]}"` };
  return {
    style: `<style>path{fill:${SALA_LOGO_INK.light}}@media(prefers-color-scheme:dark){path{fill:${SALA_LOGO_INK.dark}}}</style>`,
    attr: "",
  };
}

const svgOpen = (w: number, h: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Kultura">`;

/** El símbolo solo (favicon y espacios estrechos). */
export function salaSymbolSvg(theme: Theme = "auto"): string {
  const f = fill(theme);
  return `${svgOpen(100, 100)}${f.style}<path${f.attr} fill-rule="evenodd" d="${SALA_SYMBOL_PATH}"/></svg>\n`;
}

/** Símbolo + palabra. */
export function salaLogotypeSvg(theme: Theme = "auto"): string {
  const f = fill(theme);
  return `${svgOpen(SALA_LOGOTYPE_WIDTH, SALA_LOGO_HEIGHT)}${f.style}<path${f.attr} fill-rule="evenodd" d="${SALA_SYMBOL_PATH}"/><path${f.attr} d="${SALA_WORD_PATH}"/></svg>\n`;
}

/** Icono cuadrado de la app: fondo de noche a sangre y el símbolo centrado en tinta. */
export function salaAppIconSvg(kind: keyof typeof SALA_ICON_SCALE = "any"): string {
  const side = 100 / SALA_ICON_SCALE[kind];
  const r = (v: number) => Math.round(v * 100) / 100;
  const o = r(-(side - 100) / 2);
  return `${svgOpen(100, 100).replace("0 0 100 100", `${o} ${o} ${r(side)} ${r(side)}`)}<path fill="${SALA_ICON_BACKGROUND}" d="M${o} ${o}h${r(side)}v${r(side)}h-${r(side)}z"/><path fill="${SALA_LOGO_INK.dark}" fill-rule="evenodd" d="${SALA_SYMBOL_PATH}"/></svg>\n`;
}

/** Los archivos de `public/brand/` y su contenido. */
export function salaBrandFiles(): Record<string, string> {
  return {
    "kultura-simbolo.svg": salaSymbolSvg(),
    "kultura-logotipo.svg": salaLogotypeSvg(),
    "kultura-logotipo-noche.svg": salaLogotypeSvg("dark"),
    "kultura-logotipo-dia.svg": salaLogotypeSvg("light"),
    "kultura-icono.svg": salaAppIconSvg("any"),
    "kultura-icono-maskable.svg": salaAppIconSvg("maskable"),
  };
}
