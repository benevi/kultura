// Contratos MÍNIMOS de la tienda de Steam (COD-1). API no versionada: todo
// opcional; el cliente nunca lanza hacia fuera (CONTRATO DE DEGRADACIÓN).
import { z } from "zod";

/** /api/appdetails: `{ "<appid>": { success, data } }` (o `null`). */
export const steamAppDetailsSchema = z
  .record(
    z.string(),
    z
      .looseObject({
        success: z.boolean().optional(),
        data: z.looseObject({}).optional(),
      })
      .nullish()
  )
  .nullable();

/** /api/storesearch. */
export const steamStoreSearchSchema = z.looseObject({
  total: z.number().optional(),
  items: z
    .array(
      z.looseObject({ id: z.number().optional(), name: z.string().optional() })
    )
    .optional(),
});
