// Contratos MÍNIMOS de AniList (GraphQL, COD-1). Los `errors[]` se comprueban
// antes (`checkBody` en `anilist.ts`); aquí solo la forma de `data`.
import { z } from "zod";

const media = z.looseObject({ id: z.number() });

/** Query de catálogo/búsqueda: `data.Page.media[]`. */
export const anilistPageSchema = z.looseObject({
  data: z.looseObject({
    Page: z.looseObject({
      media: z.array(media),
      pageInfo: z.looseObject({}).optional(),
    }),
  }),
});

/** Query de detalle: `data.Media`. */
export const anilistMediaSchema = z.looseObject({
  data: z.looseObject({ Media: media }),
});
