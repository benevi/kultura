/**
 * La tarjeta del sitio también en /login. La página define su propio
 * `openGraph` y Next 14 entonces no hereda la imagen del layout: la imagen
 * por archivo de este segmento sí se aplica.
 *
 * Con `generateImageMetadata` el `alt` sale en el idioma de la página
 * (/en/login en inglés) y la imagen vive en `/login/opengraph-image/card`,
 * igual que la de la portada.
 */
export { default, alt, size, contentType, generateImageMetadata } from "../opengraph-image";
