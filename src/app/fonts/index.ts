import localFont from "next/font/local";

/**
 * Fuentes autoalojadas (Bricolage Grotesque y Figtree, licencia SIL OFL 1.1,
 * subconjunto latino, fuente variable de peso). Antes se descargaban de
 * Google Fonts en cada build y una respuesta rara de su API tumbaba el build
 * entero; así el build no depende de ningún servicio externo.
 */
/**
 * Display (h1 de la portada y de los rankings, que es el LCP): `optional`
 * (REN-7, F-22). Con `swap` el LCP esperaba al cambio de fuente (~3 s en
 * móvil) y el cambio movía la cabecera. Con `optional` el navegador espera
 * ~100 ms: si la fuente (precargada) llega, se usa; si no, ese primer pintado
 * se queda con la de reserva ajustada (`adjustFontFallback`, Arial con las
 * métricas de Bricolage) y la fuente se usa desde la siguiente página, ya en
 * caché (inmutable un año). Nunca hay salto.
 */
export const bricolageGrotesque = localFont({
  src: "./BricolageGrotesque-latin.woff2",
  weight: "200 800",
  variable: "--font-display",
  display: "optional",
  adjustFontFallback: "Arial",
});

/** Texto: `swap` con reserva de métricas ajustadas (el salto es mínimo). */
export const figtree = localFont({
  src: "./Figtree-latin.woff2",
  weight: "300 900",
  variable: "--font-body",
  display: "swap",
  adjustFontFallback: "Arial",
});
