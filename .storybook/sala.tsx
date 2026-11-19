import type { CSSProperties, ReactNode } from "react";
import { paletteFromSwatches, type ImagePalette } from "@/lib/design/image-palette";
import { SALA_WORK_CLASS, workPaletteVars } from "@/lib/design/sala-palette";

/**
 * Piezas comunes de las historias de componentes de «Sala»: el suelo donde se
 * enseñan (los neutros o el color de una obra) y unas obras de ejemplo. Vive
 * aquí y no en `src` porque solo es de Storybook: sus clases y sus textos no
 * entran en la app.
 */

/** Una imagen de un solo color: basta para ver un componente sobre una paleta. */
const deColor = (l: number, c: number, h: number) =>
  paletteFromSwatches([{ rgb: [0, 0, 0], oklch: { l, c, h }, share: 1 }]);

export interface ObraDeEjemplo {
  titulo: string;
  original?: { texto: string; lang: string };
  formato: string;
  sinopsis: string;
  palette: ImagePalette;
}

/**
 * Tres obras reales, de tres formatos. La paleta es de ejemplo (un solo
 * color): la de verdad sale de la imagen de la obra, en la ficha.
 */
export const OBRAS: ObraDeEjemplo[] = [
  {
    titulo: "Parásitos",
    original: { texto: "기생충", lang: "ko" },
    formato: "Película",
    sinopsis: "Una familia sin trabajo se va colando, uno a uno, en la casa de otra que lo tiene todo.",
    palette: deColor(0.72, 0.13, 165),
  },
  {
    titulo: "El viaje de Chihiro",
    original: { texto: "千と千尋の神隠し", lang: "ja" },
    formato: "Anime",
    sinopsis: "Chihiro, de diez años, se pierde en un mundo de dioses y tiene que trabajar para salir de él.",
    palette: deColor(0.58, 0.21, 28),
  },
  {
    titulo: "Berserk",
    original: { texto: "ベルセルク", lang: "ja" },
    formato: "Manga",
    sinopsis: "Guts, un mercenario con una espada más grande que él, persigue a quien lo traicionó.",
    palette: deColor(0.45, 0.16, 258),
  },
];

/**
 * Un tramo de página con su fondo: los neutros o, con `palette`, el contenedor
 * de una obra (`sala-work`). El tema lo pone la barra de Storybook.
 */
export function Suelo({
  titulo,
  nota,
  palette,
  children,
}: {
  titulo: string;
  nota?: string;
  palette?: ImagePalette;
  children: ReactNode;
}) {
  return (
    <section
      lang="es"
      className={`${palette ? SALA_WORK_CLASS : ""} bg-sala-background px-sala-margin py-10 text-sala-ink sala-type-text`}
      style={palette ? (workPaletteVars(palette) as CSSProperties) : undefined}
    >
      <h2 className="sala-type-heading">{titulo}</h2>
      {nota ? <p className="mt-2 max-w-2xl text-sala-ink-secondary sala-type-small">{nota}</p> : null}
      <div className="mt-8">{children}</div>
    </section>
  );
}

export const NOTA_PALETA = "Paleta de ejemplo, de un solo color: la de verdad sale de la imagen de la obra.";

/** Una fila de muestras con su pie: qué estado es cada una. */
export function Muestras({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="mb-10 last:mb-0">
      <h3 className="mb-4 sala-type-data">{titulo}</h3>
      <ul className="flex flex-wrap items-start gap-x-6 gap-y-6">{children}</ul>
    </div>
  );
}

export function Muestra({ pie, children }: { pie: string; children: ReactNode }) {
  return (
    <li className="flex flex-col items-start gap-2">
      {children}
      <span className="text-sala-ink-secondary sala-type-small">{pie}</span>
    </li>
  );
}

/** Iconos de trazo recto para las historias. La app pondrá los suyos en la 8.5. */
const trazo = {
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "square",
} as const;

export const IconoMas = () => (
  <svg {...trazo}>
    <path d="M10 3v14M3 10h14" />
  </svg>
);

export const IconoCerrar = () => (
  <svg {...trazo}>
    <path d="M4 4l12 12M16 4 4 16" />
  </svg>
);

export const IconoSeguir = () => (
  <svg {...trazo}>
    <path d="M3 10h13M11 5l5 5-5 5" />
  </svg>
);

export const IconoPapelera = () => (
  <svg {...trazo}>
    <path d="M3 5h14M8 5V3h4v2M5 5l1 12h8l1-12" />
  </svg>
);
