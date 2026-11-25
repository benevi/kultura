// ============================================================
// KULTURA — La hoja del rótulo de «Sala» (`src/styles/sala/title.css`)
// ------------------------------------------------------------
// Se genera desde aquí (`npm run title:sala`) y la comprueba
// `tests/unit/design/sala-title-css.test.ts`. Lleva tres cosas:
//
// 1. La fuente de respaldo de Anybody, con métricas ajustadas por tramo de
//    anchura: mientras llega Anybody, el título ocupa las mismas líneas.
// 2. Las reglas del rótulo (`SalaTitle`): el tamaño en unidades del
//    contenedor y qué saltos de línea valen en la caja estrecha y en la ancha.
// 3. Las reglas del rótulo sobre la imagen (`SalaStage`): el velo, la entrada
//    y el fundido, con sus apagados.
//
// Va en una hoja aparte y no en clases de Tailwind para que no entre en el
// CSS de las pantallas de hoy: la carga quien pinta un rótulo.
// ============================================================

import { SALA_TITLE_ASCENT, SALA_TITLE_DESCENT, SALA_TITLE_FALLBACK, SALA_TITLE_FALLBACK_RANGE } from './sala-title-metrics'
import { SALA_TITLE_WIDE_FROM_REM } from './sala-title'
import { SALA_FAMILY } from './sala-tokens'

/**
 * Fuentes del sistema que hacen de respaldo, por su nombre completo y por el
 * de PostScript (Safari). Arial Bold, y las que miden lo mismo que ella
 * (Liberation Sans, Arimo); en Android no hay ninguna y va Roboto, algo más
 * estrecha. Si no hay ninguna, la regla no vale y el título cae en el resto
 * de la pila, sin ajuste.
 */
const FALLBACK_LOCALS = [
  'Arial Bold',
  'Arial-BoldMT',
  'Liberation Sans Bold',
  'LiberationSans-Bold',
  'Arimo Bold',
  'Arimo-Bold',
  'Roboto Bold',
  'Roboto-Bold',
]

/** Nombres que el componente escribe en el HTML: variables y atributos. */
export const SALA_TITLE_CSS = {
  /** Contenedor del rótulo: de su ancho sale el tamaño. */
  box: 'sala-title',
  /** El texto del rótulo (dentro del encabezado). */
  text: 'sala-title-text',
  /** El título original, debajo. */
  original: 'sala-title-original',
  /** La sala: imagen, velo y rótulo. */
  stage: 'sala-stage',
  stageImage: 'sala-stage-image',
  stageVeil: 'sala-stage-veil',
  stageFigure: 'sala-stage-figure',
  stageHeading: 'sala-stage-heading',
  stageBelow: 'sala-stage-below',
  vars: {
    narrowSize: '--sala-title-n-size',
    narrowStretch: '--sala-title-n-stretch',
    narrowBlock: '--sala-title-n-block',
    wideSize: '--sala-title-w-size',
    wideStretch: '--sala-title-w-stretch',
    wideBlock: '--sala-title-w-block',
    /** Lo que vale una centésima del ancho disponible. Por defecto, `1cqw`. */
    unit: '--sala-title-unit',
    /** Tope de tamaño que pone quien usa el rótulo (el alto de la sala). */
    cap: '--sala-title-cap',
    /** Suelo de tamaño (el póster, en `rem`). */
    floor: '--sala-title-floor',
    /** Opacidad del velo (0–1). */
    veil: '--sala-stage-veil',
    /** Opacidad mínima del velo: la sube `prefers-contrast: more`. */
    veilMin: '--sala-stage-veil-min',
    /** Fondo negro fijo bajo el velo (0–1): suelo de contraste que no depende de la paleta. */
    scrim: '--sala-stage-scrim',
    /** Fondo del fundido en la caja estrecha y en la ancha. */
    fuseNarrow: '--sala-fuse-n',
    fuseWide: '--sala-fuse-w',
    /** Punto de interés de la imagen (`object-position`). */
    focus: '--sala-stage-focus',
  },
} as const

const pct = (n: number) => `${Number((n * 100).toFixed(1))}%`

function fallbackFaces(): string {
  return SALA_TITLE_FALLBACK.map(
    ({ from, to, sizeAdjust }) => `@font-face {
  font-family: "${SALA_FAMILY.displayFallback}";
  font-style: normal;
  font-weight: 100 900;
  font-stretch: ${from}% ${to}%;
  src: ${FALLBACK_LOCALS.map((name) => `local("${name}")`).join(', ')};
  size-adjust: ${pct(sizeAdjust)};
  ascent-override: ${pct(SALA_TITLE_ASCENT / sizeAdjust)};
  descent-override: ${pct(SALA_TITLE_DESCENT / sizeAdjust)};
  line-gap-override: 0%;
  unicode-range: ${SALA_TITLE_FALLBACK_RANGE};
}`,
  ).join('\n\n')
}

/** La hoja del rótulo. */
export function salaTitleCss(): string {
  const c = SALA_TITLE_CSS
  const v = c.vars
  const wide = `(min-width: ${SALA_TITLE_WIDE_FROM_REM}rem)`
  const size = (name: string) => `clamp(var(${v.floor}, 0px), calc(var(${name}) * var(${v.unit}, 1cqw)), var(${v.cap}, 1000rem))`
  const veilColor = `color-mix(in srgb, var(--sala-background) calc(max(var(${v.veil}, 0.7), var(${v.veilMin}, 0)) * 100%), transparent)`
  // Hueco sobre la primera línea: lo que asoma de las letras sobre su caja (y el margen). El velo empieza ahí.
  const rise = (name: string) => `max(var(--sala-margin), 0.25 * ${size(name)})`
  // Quien pide menos movimiento o más contraste, o tiene colores forzados, no tiene fundido.
  const fuseOk = '(prefers-reduced-motion: no-preference) and (prefers-contrast: no-preference) and (forced-colors: none)'
  const fused = (name: string) => `background: var(${name});
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        animation: sala-stage-fuse-wait 0s linear var(--sala-duration-slow) backwards;`

  return `/* GENERADO desde src/lib/design/sala-title-css.ts. No editar: npm run title:sala */

/* ------------------------------------------------------------
   1. Respaldo de Anybody mientras llega la fuente.
   Arial Bold (o su equivalente) escalada por tramo del eje de anchura para
   que nunca mida más que Anybody: el título ocupa las mismas líneas con una
   y con otra, y la caja no cambia de alto. Solo cubre lo que cubre Anybody.
   ------------------------------------------------------------ */

${fallbackFaces()}

/* ------------------------------------------------------------
   2. El rótulo (SalaTitle).
   El servidor decide por dónde se parte, la anchura y el tamaño como parte
   del ancho de la caja; aquí solo se elige entre la composición estrecha y
   la ancha según lo que mida el contenedor.
   ------------------------------------------------------------ */

.${c.box} {
  container-type: inline-size;
}

/* Sin unidades de contenedor (navegadores de antes de 2023): un título normal, que parte donde puede.
   \`:where\`: quien lo usa puede cambiarle el \`display\` (el póster lo corta a cuatro líneas). */
:where(.${c.text}) {
  display: block;
}

.${c.text} {
  font-size: clamp(1.75rem, 9vw, 4rem);
  overflow-wrap: anywhere;
}

.${c.text} > br {
  display: none;
}

.${c.original} {
  margin: 0.5em 0 0;
  font-family: var(--sala-font-display);
  font-weight: 700;
  font-size: clamp(1.125rem, 3.4cqw, 1.75rem);
  line-height: 1.15;
  overflow-wrap: anywhere;
}

@supports (width: 1cqw) {
  .${c.text} {
    font-size: ${size(v.narrowSize)};
    font-stretch: var(${v.narrowStretch});
  }

  .${c.text} > br[data-n] {
    display: inline;
  }

  @container ${wide} {
    .${c.text} {
      font-size: ${size(v.wideSize)};
      font-stretch: var(${v.wideStretch});
    }

    .${c.text} > br[data-n] {
      display: none;
    }

    .${c.text} > br[data-w] {
      display: inline;
    }
  }
}

/* ------------------------------------------------------------
   3. El rótulo sobre la imagen (SalaStage).
   La imagen llena la sala; encima, el velo; encima, el título, abajo.
   El encabezado ocupa la sala entera (subrejilla): así su fondo casa con la
   imagen sin medir nada, y el fundido es el propio texto pintado con la
   figura (\`background-clip: text\`), sin repetir el título.
   ------------------------------------------------------------ */

/* Filas: hueco que se encoge (la imagen), el título, lo de debajo y el margen.
   El título y lo de debajo nunca se recortan: si no caben en el alto que se le
   da, la sala crece. Por eso quien la usa le pone un alto mínimo (o una
   proporción), nunca un alto fijo ni un máximo. Sobre el título queda siempre
   un hueco (el margen o un cuarto del cuerpo, lo mayor), donde cabe lo que
   asoman las letras; lo demás, como el fundido del velo, se recorta. */
.${c.stage} {
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr) auto auto var(--sala-margin);
  overflow: clip;
  container-type: inline-size;
  ${v.unit}: calc((100cqw - 2 * var(--sala-margin)) / 100);
}

@media (prefers-contrast: more) {
  .${c.stage} {
    ${v.veilMin}: 0.85;
  }
}

.${c.stageImage},
.${c.stageFigure} {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.${c.stageImage} > img,
.${c.stageFigure} {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: var(${v.focus}, 50% 50%);
}

/* El velo sigue al contenido: opaco desde el hueco sobre el título hasta
   abajo (lo de debajo y el margen incluidos) y, encima, un fundido de 12cqw. */
.${c.stageVeil} {
  position: relative;
  grid-area: 2 / 1 / -1 / -1;
  pointer-events: none;
  background: ${veilColor};
}

.${c.stageVeil}::before {
  content: "";
  position: absolute;
  inset-inline: 0;
  bottom: 100%;
  height: 12cqw;
  background: linear-gradient(to top, ${veilColor}, transparent);
}

/* Con \`scrim\` (la ficha, F6): encima del velo, un negro de opacidad fija que
   no depende de la paleta. Solo entonces lleva capa de imagen: sin él, axe
   sigue midiendo el velo como un color liso. */
.${c.stage}[data-sala-scrim] .${c.stageVeil} {
  background-image: linear-gradient(rgb(0 0 0 / var(${v.scrim})), rgb(0 0 0 / var(${v.scrim})));
}

.${c.stage}[data-sala-scrim] .${c.stageVeil}::before {
  background-image: linear-gradient(to top, rgb(0 0 0 / var(${v.scrim})), transparent),
    linear-gradient(to top, ${veilColor}, transparent);
}

/* La figura solo se pinta con el fundido encendido. */
.${c.stageFigure} {
  display: none;
  pointer-events: none;
}

.${c.stageHeading} {
  position: relative;
  grid-area: 1 / 1 / -1 / -1;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr) auto auto var(--sala-margin);
  margin: 0;
}

@supports (grid-template-rows: subgrid) {
  .${c.stageHeading} {
    grid-template-rows: subgrid;
  }
}

.${c.stageHeading} > .${c.text} {
  grid-row: 2;
  align-self: end;
  margin-top: ${rise(v.narrowSize)};
  padding-inline: var(--sala-margin);
  animation: sala-title-rise var(--sala-duration-slow) var(--sala-ease) backwards;
}

.${c.stageHeading} ::selection {
  background: var(--sala-ink);
  color: var(--sala-background);
}

.${c.stageBelow} {
  position: relative;
  grid-area: 3 / 1;
  padding: 0.75rem var(--sala-margin) 0;
}

/* Biblia §6: el título sube. Sin opacidad: lo que se ve desde el primer momento es el título. */
@keyframes sala-title-rise {
  from {
    transform: translateY(0.18em);
  }
}

/* El fundido espera a que el título esté en su sitio y entonces aparece, sin animarse. */
@keyframes sala-stage-fuse-wait {
  from {
    background-image: none;
    color: var(--sala-ink);
  }
}

@keyframes sala-stage-figure-wait {
  from {
    visibility: hidden;
  }
}

@container ${wide} {
  .${c.stageHeading} > .${c.text} {
    margin-top: ${rise(v.wideSize)};
  }
}

@supports (grid-template-rows: subgrid) and ((background-clip: text) or (-webkit-background-clip: text)) {
  @media ${fuseOk} {
    .${c.stage}[data-sala-fuse~="n"] .${c.stageFigure} {
      display: block;
      animation: sala-stage-figure-wait 0s linear var(--sala-duration-slow) backwards;
    }

    .${c.stage}[data-sala-fuse~="n"] .${c.stageHeading} {
        ${fused(v.fuseNarrow)}
    }

    @container ${wide} {
      .${c.stage}[data-sala-fuse~="n"] .${c.stageFigure} {
        display: none;
      }

      .${c.stage}[data-sala-fuse~="n"] .${c.stageHeading} {
        background: none;
        color: inherit;
        animation: none;
      }

      .${c.stage}[data-sala-fuse~="w"] .${c.stageFigure} {
        display: block;
        animation: sala-stage-figure-wait 0s linear var(--sala-duration-slow) backwards;
      }

      .${c.stage}[data-sala-fuse~="w"] .${c.stageHeading} {
        ${fused(v.fuseWide)}
      }
    }
  }
}

/* Movimiento reducido (del sistema o el interruptor de la app, \`data-sala-motion="reduce"\`):
   todo quieto y nada oculto (biblia §6). Sin entrada y sin fundido. */
@media (prefers-reduced-motion: reduce) {
  .${c.stageHeading} > .${c.text} {
    animation: none;
  }
}

[data-sala-motion="reduce"] .${c.stageHeading} > .${c.text},
.${c.stage}[data-sala-motion="reduce"] .${c.stageHeading} > .${c.text} {
  animation: none;
}

[data-sala-motion="reduce"] .${c.stage} .${c.stageFigure},
.${c.stage}[data-sala-motion="reduce"] .${c.stageFigure} {
  display: none;
}

[data-sala-motion="reduce"] .${c.stage} .${c.stageHeading},
.${c.stage}[data-sala-motion="reduce"] .${c.stageHeading} {
  background: none;
  color: inherit;
  animation: none;
}
`
}
