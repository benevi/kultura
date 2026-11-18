// Dirección A «Sala» — fuentes (solo en esta rama, por `next/font/google`).
// Anybody: SIL OFL 1.1 — https://github.com/Etcetera-Type-Co/Anybody
//   (licencia: https://github.com/google/fonts/blob/main/ofl/anybody/OFL.txt)
// Instrument Sans: SIL OFL 1.1 — https://github.com/Instrument/instrument-sans
//   (licencia: https://github.com/google/fonts/blob/main/ofl/instrumentsans/OFL.txt)

import { Anybody, Instrument_Sans } from "next/font/google";

/** Rótulo: variable en peso y ANCHURA (50–150): el título se ensancha o se estrecha hasta llenar la sala. */
const display = Anybody({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-a-display",
});

const text = Instrument_Sans({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-a-text",
});

export const fontClassName = `${display.variable} ${text.variable}`;
