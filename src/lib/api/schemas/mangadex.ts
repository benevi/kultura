// Contratos MÍNIMOS de MangaDex (COD-1). `relationships` es obligatorio porque
// la portada se busca en él sin comprobarlo (`extractMangaCover`).
import { z } from "zod";

const manga = z.looseObject({
  id: z.string(),
  attributes: z.looseObject({}),
  relationships: z.array(z.looseObject({ type: z.string() })),
});

/** /manga (búsqueda y catálogo). */
export const mangaDexListSchema = z.looseObject({
  data: z.array(manga),
  total: z.number().optional(),
  offset: z.number().optional(),
});

/** /manga/{id}. */
export const mangaDexDetailSchema = z.looseObject({ data: manga });
