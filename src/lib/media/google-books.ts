// ============================================================
// KULTURA — Atribución de Google Books (fase 8.1)
//
// Las normas de marca de la Books API
// (https://developers.google.com/books/branding) piden dos cosas cada vez que
// se enseña información de un libro sacada de la API: el logo «Powered by
// Google» junto a esos resultados y un enlace destacado a la página del libro
// en Google Libros.
//
// Un libro trae datos de Google en dos casos:
//   - su id ES un volumen de Google Books (respaldo de la búsqueda de libros y
//     de cómic, y fichas guardadas cuando el catálogo era de Google);
//   - es de Open Library pero la ficha se completó con la portada y la
//     sinopsis de Google (`enrichBookWithGoogle` deja `metadata.googleBooksId`).
//
// Sin dependencias de servidor: lo usan la ficha y los resultados del cliente.
// ============================================================

import type { MediaItem } from "@/types/media";

/** Logo oficial (62 × 30), copiado de books.google.com sin modificar. `alt`: la marca no se traduce. */
export const GOOGLE_BOOKS_LOGO = {
  src: "/brands/powered-by-google.png",
  width: 62,
  height: 30,
  alt: "Powered by Google",
} as const;

const OPEN_LIBRARY_ID = /^OL\d+[WM]$/i;
const VOLUME_ID = /^[A-Za-z0-9_-]{6,24}$/;

type BookRef = Pick<MediaItem, "type" | "externalId"> & { metadata?: Record<string, unknown> | null };

/** Id del volumen de Google Books del que salen datos de este título, o `null`. */
export function googleBooksVolumeId(item: BookRef): string | null {
  if (item.type !== "book") return null;
  const enriched = item.metadata?.googleBooksId;
  if (typeof enriched === "string" && VOLUME_ID.test(enriched)) return enriched;
  if (OPEN_LIBRARY_ID.test(item.externalId)) return null;
  return VOLUME_ID.test(item.externalId) ? item.externalId : null;
}

/** Página del libro en Google Libros. */
export function googleBooksUrl(volumeId: string): string {
  return `https://books.google.com/books?id=${encodeURIComponent(volumeId)}`;
}
