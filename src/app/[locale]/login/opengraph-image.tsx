/**
 * La tarjeta del sitio también en /login. La página define su propio
 * `openGraph` y Next 14 entonces no hereda la imagen del layout: la imagen
 * por archivo de este segmento sí se aplica.
 */
export { default, alt, size, contentType } from "../opengraph-image";
