// Contratos MÍNIMOS de Open Library (COD-1).
import { z } from "zod";

/** /search.json. */
export const openLibrarySearchSchema = z.looseObject({
  docs: z.array(z.looseObject({ key: z.string() })),
  numFound: z.number().optional(),
});

/** /works/{id}.json (solo se lee la sinopsis, en texto o `{ value }`). */
export const openLibraryWorkSchema = z.looseObject({
  description: z
    .union([z.string(), z.looseObject({ value: z.string() })])
    .optional(),
});
