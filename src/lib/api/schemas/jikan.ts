// Contratos MÍNIMOS de Jikan (COD-1). Solo resuelve ids legacy de MAL.
import { z } from "zod";

/** /anime/{id}/full y /manga/{id}/full. */
export const jikanDetailSchema = z.looseObject({
  data: z.looseObject({ mal_id: z.number() }),
});

/** /anime/{id}/videos. */
export const jikanVideosSchema = z.looseObject({
  data: z.looseObject({}),
});
