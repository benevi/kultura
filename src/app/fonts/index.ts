import localFont from "next/font/local";

/**
 * Fuentes autoalojadas (Bricolage Grotesque y Figtree, licencia SIL OFL 1.1,
 * subconjunto latino, fuente variable de peso). Antes se descargaban de
 * Google Fonts en cada build y una respuesta rara de su API tumbaba el build
 * entero; así el build no depende de ningún servicio externo.
 */
export const bricolageGrotesque = localFont({
  src: "./BricolageGrotesque-latin.woff2",
  weight: "200 800",
  variable: "--font-display",
  display: "swap",
});

export const figtree = localFont({
  src: "./Figtree-latin.woff2",
  weight: "300 900",
  variable: "--font-body",
  display: "swap",
});
