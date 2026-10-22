// Contratos MÍNIMOS de Google Books (COD-1). `items` falta (no es `[]`) cuando
// no hay resultados: por eso es opcional.
import { z } from "zod";

const volume = z.looseObject({ id: z.string() });

/** /volumes?q=… */
export const googleBooksSearchSchema = z.looseObject({
  totalItems: z.number().optional(),
  items: z.array(volume).optional(),
});

/** /volumes/{id}. */
export const googleBooksVolumeSchema = volume;
