// ============================================================
// KULTURA — La hoja de la vertical que llena la sala (fase 8.5, F4)
// ------------------------------------------------------------
// Genera `src/styles/sala/poster.css` (ver `sala-poster.ts`). Aparte para que
// el cliente (`SalaFichaImage`) no cargue las medidas del rótulo.
// ============================================================

import { SALA_TITLE_CSS } from "./sala-title-css";
import { SALA_POSTER_BOOK_WIDTH_REM, SALA_POSTER_FILL_STEPS } from "./sala-poster";

/**
 * La hoja `src/styles/sala/poster.css`: la composición de libro de la sala con
 * vertical, por encima del ancho que le toca. La comprueba
 * `tests/unit/design/sala-poster.test.ts` (`-u` para regenerarla).
 */
export function salaPosterCss(): string {
  const c = SALA_TITLE_CSS;
  const at = (fill: string) => `.${c.stage}[data-sala-fill="${fill}"]`;
  const book = (s: string) =>
    [
      `${s} {`,
      `  aspect-ratio: auto;`,
      `  padding-top: 2rem;`,
      `  color: var(--sala-band-ink);`,
      `}`,
      `${s} .${c.stageImage} {`,
      `  position: relative;`,
      `  inset: auto;`,
      `  grid-area: 1 / 1;`,
      `  justify-self: center;`,
      `  width: min(calc(100% - 2 * var(--sala-margin)), ${SALA_POSTER_BOOK_WIDTH_REM}rem);`,
      `  height: auto;`,
      `  aspect-ratio: 2 / 3;`,
      `}`,
      `${s} .${c.stageImage} > img {`,
      `  object-fit: contain;`,
      `}`,
      `${s} .${c.stageVeil} {`,
      `  display: none;`,
      `}`,
      `${s} .${c.stageHeading} > .${c.text} {`,
      `  margin-top: 2rem;`,
      `}`,
    ].join("\n");
  const indent = (s: string) =>
    s
      .split("\n")
      .map((l) => `  ${l}`)
      .join("\n");
  const parts = [
    `/* Generado por salaPosterCss() (src/lib/design/sala-poster-css.ts). No editar a mano. */`,
    ``,
    `/* La vertical que llena la sala (fase 8.5, F4; biblia §2): por encima del`,
    `   ancho de ventana de \`data-sala-fill\`, la imagen pasaría de 1,25 veces su`,
    `   tamaño natural y la obra se compone como un libro: la portada entera`,
    `   sobre su campo de color y el título debajo, sin velo. */`,
    ``,
    book(at("none")),
    ...SALA_POSTER_FILL_STEPS.map((step) => `\n@media (min-width: ${step + 0.02}px) {\n${indent(book(at(`${step}`)))}\n}`),
    ``,
  ];
  return parts.join("\n");
}
