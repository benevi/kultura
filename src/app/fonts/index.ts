import localFont from "next/font/local";
import { Lilita_One } from "next/font/google";

/**
 * Tipografía del «Álbum de cromos» (DISENO.md):
 *
 * - Display: **Lilita One** (Google Fonts, SIL OFL 1.1, un solo peso, 400),
 *   subconjuntos latino y latino extendido. Solo titulares, numerales de
 *   hueco y de ranking y la nota grande; nunca texto corrido, etiquetas ni
 *   botones. `optional` (REN-7, F-22): el h1 es el LCP; si la fuente
 *   (precargada) no llega en ~100 ms ese primer pintado se queda con la de
 *   reserva de métricas ajustadas y la fuente se usa desde la siguiente
 *   página, ya en caché. Nunca hay salto.
 * - Texto: **Figtree**, autoalojada (variable de peso), `swap`.
 * - Logotipo: el wordmark «kultura» se mantiene en Bricolage Grotesque 700
 *   (la marca no cambia con el sistema). Es un subconjunto de 6 glifos
 *   (k, u, l, t, r, a; ~1 KB), no la familia entera.
 */
export const lilitaOne = Lilita_One({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  display: "optional",
});

/** Texto: `swap` con reserva de métricas ajustadas (el salto es mínimo). */
export const figtree = localFont({
  src: "./Figtree-latin.woff2",
  weight: "300 900",
  variable: "--font-body",
  display: "swap",
  adjustFontFallback: "Arial",
});

/** Solo el wordmark del logotipo (glifos de «kultura» a 700). */
export const logoFont = localFont({
  src: "./BricolageGrotesque-logo.woff2",
  weight: "700",
  variable: "--font-logo",
  display: "block",
  adjustFontFallback: "Arial",
});

/** Clases de variable de las tres familias, para el `<body>`. */
export const fontVariables = `${lilitaOne.variable} ${figtree.variable} ${logoFont.variable}`;
