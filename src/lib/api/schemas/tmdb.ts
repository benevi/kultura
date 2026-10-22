// Contratos MÍNIMOS de TMDB (COD-1). Solo se exige lo que, si falta, rompe la
// app (un `id`, la lista `results`); el resto es opcional y `looseObject`
// conserva cualquier campo nuevo. Ver `src/lib/api/http.ts`.
import { z } from "zod";

const item = z.looseObject({ id: z.number() });

/** /search, /discover, /movie/popular, /trending… */
export const tmdbListSchema = z.looseObject({
  results: z.array(item),
  total_pages: z.number().optional(),
  total_results: z.number().optional(),
});

/** /movie/{id} y /tv/{id}. */
export const tmdbDetailSchema = item;

/** /movie/{id}/videos: la ficha recorre `results` sin comprobarlo. */
export const tmdbVideosSchema = z.looseObject({
  results: z.array(z.looseObject({})),
});

/** /…/watch/providers: `results` por país (con `link` a la página de TMDB). */
export const tmdbProvidersSchema = z.looseObject({
  results: z
    .record(z.string(), z.looseObject({ link: z.string().optional() }))
    .optional(),
});

/** /genre/{kind}/list. */
export const tmdbGenresSchema = z.looseObject({
  genres: z.array(z.looseObject({ id: z.number(), name: z.string() })),
});

/** /configuration (sonda barata para `/api/health?deep=1`). */
export const tmdbConfigurationSchema = z.looseObject({
  images: z.looseObject({}).optional(),
});
