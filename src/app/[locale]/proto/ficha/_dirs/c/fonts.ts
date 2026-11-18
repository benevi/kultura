// Dirección C «Pliego» — fuentes (solo en esta rama, por `next/font/google`:
// no se añade ningún archivo de fuente al repo). Licencias comprobadas el
// 18-11-2026 en el OFL.txt de cada familia:
// Fraunces: SIL OFL 1.1 — https://github.com/undercasetype/Fraunces
//   (https://github.com/google/fonts/blob/main/ofl/fraunces/OFL.txt)
// Geist: SIL OFL 1.1 — https://github.com/vercel/geist-font
//   (https://github.com/google/fonts/blob/main/ofl/geist/OFL.txt)
// Schibsted Grotesk (alternativa sin serif, `?serif=0`): SIL OFL 1.1 —
//   https://github.com/schibsted/schibsted-grotesk
//   (https://github.com/google/fonts/blob/main/ofl/schibstedgrotesk/OFL.txt)
// Noto Serif KR / JP (hangul y japonés del rótulo con serif): SIL OFL 1.1 —
//   https://github.com/notofonts/noto-cjk
//   (https://github.com/google/fonts/blob/main/ofl/notoserifkr/OFL.txt y …/notoserifjp/OFL.txt)

import { Fraunces, Geist, Noto_Serif_JP, Noto_Serif_KR, Schibsted_Grotesk } from "next/font/google";

/** Rótulo: serif variable con eje óptico (hasta 144) y eje SOFT; se usa fina y grande. */
const serif = Fraunces({
  subsets: ["latin", "latin-ext"],
  axes: ["opsz", "SOFT"],
  display: "swap",
  variable: "--font-c-serif",
});

/** Texto y datos. */
const text = Geist({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-c-text",
});

/** Rótulo alternativo sin serif. Sin precarga: solo se baja si se pide `?serif=0`. */
const grotesk = Schibsted_Grotesk({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: false,
  variable: "--font-c-grotesk",
});

// Sin precarga: Google las sirve troceadas y solo se bajan los trozos de los caracteres presentes.
const serifKr = Noto_Serif_KR({ weight: "variable", preload: false, display: "swap", variable: "--font-c-serif-kr" });
const serifJp = Noto_Serif_JP({ weight: "variable", preload: false, display: "swap", variable: "--font-c-serif-jp" });

export const fontClassName = `${serif.variable} ${text.variable} ${grotesk.variable} ${serifKr.variable} ${serifJp.variable}`;
