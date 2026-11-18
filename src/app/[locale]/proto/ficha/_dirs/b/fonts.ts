// Dirección B «Objeto» — fuentes (solo en esta rama, por `next/font/google`;
// no se añade ningún archivo de fuente al repo).
// Gabarito: SIL OFL 1.1 — https://github.com/naipefoundry/gabarito
//   (licencia comprobada el 18-11-2026: https://github.com/google/fonts/blob/main/ofl/gabarito/OFL.txt)
// DM Sans: SIL OFL 1.1 — https://github.com/googlefonts/dm-fonts
//   (licencia comprobada el 18-11-2026: https://github.com/google/fonts/blob/main/ofl/dmsans/OFL.txt)

import { DM_Sans, Gabarito } from "next/font/google";

/** Títulos y cifras: geométrica, redonda, variable de 400 a 900. */
const display = Gabarito({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-b-display",
});

/** Texto corrido y controles. */
const text = DM_Sans({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-b-text",
});

export const fontClassName = `${display.variable} ${text.variable}`;
