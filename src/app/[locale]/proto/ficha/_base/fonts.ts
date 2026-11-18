// Prototipo fase 8.3 — fuentes de respaldo para hangul y japonés, comunes a
// las tres direcciones. Noto Sans KR y Noto Sans JP (SIL OFL 1.1,
// https://github.com/notofonts/noto-cjk — licencia comprobada en
// https://github.com/google/fonts/blob/main/ofl/notosanskr/OFL.txt y
// …/ofl/notosansjp/OFL.txt). Sin precarga: Google las sirve troceadas por
// `unicode-range` y el navegador solo baja los trozos de los caracteres que
// hay en la página. Se usan con `var(--kp-cjk)` al final de cada `font-family`.

import { Noto_Sans_JP, Noto_Sans_KR } from "next/font/google";

const notoKr = Noto_Sans_KR({ weight: "variable", preload: false, display: "swap", variable: "--font-kp-kr" });
const notoJp = Noto_Sans_JP({ weight: "variable", preload: false, display: "swap", variable: "--font-kp-jp" });

export const cjkFontClassName = `${notoKr.variable} ${notoJp.variable}`;
