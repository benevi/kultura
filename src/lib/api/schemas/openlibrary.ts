// Contratos MÍNIMOS de Open Library (COD-1).
import { z } from "zod";

/** /search.json. */
export const openLibrarySearchSchema = z.looseObject({
  docs: z.array(z.looseObject({ key: z.string() })),
  numFound: z.number().optional(),
});

/**
 * /works/{id}.json. La sinopsis siempre; el resto solo cuando la ficha se monta
 * sin el buscador (respaldo de `getBookDetail`), y todo es opcional.
 */
export const openLibraryWorkSchema = z.looseObject({
  description: z
    .union([z.string(), z.looseObject({ value: z.string() })])
    .optional(),
  title: z.string().optional(),
  authors: z
    .array(z.looseObject({ author: z.looseObject({ key: z.string() }).optional() }))
    .optional(),
  covers: z.array(z.number()).optional(),
  subjects: z.array(z.string()).optional(),
  first_publish_date: z.string().optional(),
});

/** /works/{id}/editions.json (respaldo de la ficha: portada, ISBN, editorial, idioma). */
export const openLibraryEditionsSchema = z.looseObject({
  entries: z.array(z.looseObject({})).optional(),
});

/** /authors/{id}.json (respaldo de la ficha: solo el nombre). */
export const openLibraryAuthorSchema = z.looseObject({
  name: z.string().optional(),
});
