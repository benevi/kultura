// ============================================================
// KULTURA — Catálogos de opciones de filtro para libros
//
// Desde el híbrido de libros (E-BOOKS-HIBRIDO) los filtros de libro los traduce
// `openlibrary-maps.ts`. De la antigua traducción a Google Books solo quedan
// los dos catálogos que alimentan opciones de la UI (`filter-options.ts`); el
// constructor de query y sus helpers se retiraron una vez validado el híbrido
// en producción.
// ============================================================

/** Opciones del trigger "formato" de libros. */
export const BOOKS_FORMATO: Record<string, true> = {
  free: true,
  ebook: true,
  physical: true,
};

/**
 * Editoriales de LIBRO (slug → nombre). El trigger "editorial" ya no se
 * enseña en libros (retirado a petición del usuario), pero `filter-options`
 * mantiene el catálogo para que `editorial×book` no sirva el de cómic.
 */
export const BOOKS_PUBLISHER: Record<string, string> = {
  planeta: "Planeta",
  norma: "Norma",
  ivrea: "Ivrea",
  panini: "Panini",
  salamandra: "Salamandra",
  sm: "SM",
};
