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
export const deColor = (l: number, c: number, h: number) =>
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

export const IconoLupa = () => (
  <svg {...trazo}>
    <path d="M3 3h10v10H3zM13 13l4 4" />
  </svg>
);

// ------------------------------------------------------------
// Imágenes de ejemplo
// ------------------------------------------------------------

/**
 * Una portada inventada: un SVG de colores planos en un `data:` URI. Las
 * historias no bajan nada de la red ni enseñan portadas con derechos. `ancho`
 * y `alto` son su tamaño natural en píxeles, que es lo que mide el tope de
 * ampliación; `tono` (0–360), el matiz.
 */
export function imagenDeEjemplo(ancho: number, alto: number, tono: number): string {
  const c = (l: number, croma: number, giro = 0) => `oklch(${l} ${croma} ${(tono + giro) % 360})`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">` +
    `<rect width="100%" height="100%" fill="${c(0.42, 0.12)}"/>` +
    `<rect y="${alto * 0.58}" width="100%" height="${alto * 0.42}" fill="${c(0.26, 0.08, 20)}"/>` +
    `<circle cx="${ancho * 0.64}" cy="${alto * 0.36}" r="${Math.min(ancho, alto) * 0.24}" fill="${c(0.82, 0.14, 60)}"/>` +
    `<rect x="${ancho * 0.12}" y="${alto * 0.44}" width="${ancho * 0.3}" height="${alto * 0.4}" fill="${c(0.62, 0.17, 320)}"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Un `src` que no carga nunca: el navegador da error al leerlo, sin tocar la red. */
export const IMAGEN_ROTA = "data:image/png;base64,AAAA";
// ------------------------------------------------------------
// Medidas para los `play`: contraste de lo que el navegador ha pintado
// ------------------------------------------------------------

/** Un color calculado (`rgb(…)`, `rgba(…)` o `color(srgb …)`) como r, g, b (0–255) y alfa. */
function leerColor(valor: string): { rgb: [number, number, number]; alfa: number } {
  const n = (valor.match(/-?\d*\.?\d+(e-?\d+)?/g) ?? []).map(Number);
  if (n.length < 3) throw new Error(`No es un color: «${valor}»`);
  const escala = valor.startsWith("color(") ? 255 : 1;
  return { rgb: [n[0] * escala, n[1] * escala, n[2] * escala], alfa: n[3] ?? 1 };
}

function luminancia([r, g, b]: [number, number, number]): number {
  const canal = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Contraste WCAG entre dos colores calculados opacos. */
export function contraste(a: string, b: string): number {
  const [clara, oscura] = [luminancia(leerColor(a).rgb), luminancia(leerColor(b).rgb)].sort((x, y) => y - x);
  return (clara + 0.05) / (oscura + 0.05);
}

/** El fondo que hay detrás de un elemento: el del primer antepasado que pinta uno opaco. */
export function fondoDe(elemento: Element): string {
  for (let el: Element | null = elemento.parentElement; el; el = el.parentElement) {
    const fondo = getComputedStyle(el).backgroundColor;
    if (leerColor(fondo).alfa === 1) return fondo;
  }
  throw new Error("Sin fondo opaco detrás");
}

// ------------------------------------------------------------
// Densidad de pantalla, para los `play` que miden en píxeles físicos
// ------------------------------------------------------------

/** ¿Corre la historia dentro de `npm run test:storybook`? */
export const EN_PRUEBAS = (import.meta as unknown as { env?: { MODE?: string } }).env?.MODE === "test";

/**
 * Pone la densidad de pantalla (`devicePixelRatio`) que se le diga, sin tocar
 * el tamaño de la ventana, y espera a que la página la vea. Solo funciona en
 * las pruebas de las historias (`npm run test:storybook`), con el comando
 * `salaDensidad` de `vitest.storybook.config.ts`; en el Storybook de mirar
 * devuelve `false` y no hace nada. Quien la cambia la devuelve a la de antes.
 */
export async function fijarDensidad(dpr: number): Promise<boolean> {
  try {
    const { commands } = await import("vitest/browser");
    await (commands as unknown as { salaDensidad: (dpr: number) => Promise<void> }).salaDensidad(dpr);
  } catch {
    return false;
  }
  for (let i = 0; i < 100 && window.devicePixelRatio !== dpr; i++) await new Promise((seguir) => setTimeout(seguir, 20));
  return window.devicePixelRatio === dpr;
}

// ------------------------------------------------------------
// Tamaño de la ventana, para los `play` que miden a 320 px
// ------------------------------------------------------------

/**
 * Pone el tamaño de la ventana y espera a que la página lo vea. Como
 * `fijarDensidad`, solo funciona en las pruebas de las historias; en el
 * Storybook de mirar devuelve `false` y no hace nada. Quien lo cambia lo
 * devuelve al de antes.
 */
export async function fijarVentana(ancho: number, alto: number): Promise<boolean> {
  try {
    const { page } = await import("vitest/browser");
    await page.viewport(ancho, alto);
  } catch {
    return false;
  }
  for (let i = 0; i < 100 && window.innerWidth !== ancho; i++) await new Promise((seguir) => setTimeout(seguir, 20));
  return window.innerWidth === ancho;
}
