// Contratos MÍNIMOS de ComicVine (COD-1). El `status_code` ≠ 1 (clave
// inválida, límite de peticiones…) se comprueba antes, en `comicvine.ts`
// (COD-B3); aquí solo la forma de `results`.
import { z } from "zod";

const envelope = {
  status_code: z.number().optional(),
  error: z.string().optional(),
};

const entity = z.looseObject({ id: z.number() });

/** /issues/ (búsqueda y catálogo). */
export const comicVineIssuesSchema = z.looseObject({
  ...envelope,
  results: z.array(entity),
});

/** /issue/4000-{id}/ (un único objeto). */
export const comicVineIssueSchema = z.looseObject({
  ...envelope,
  results: entity.nullable(),
});

/** /volumes/ (editorial, número de entregas y conceptos de cada volumen). */
export const comicVineVolumesSchema = z.looseObject({
  ...envelope,
  results: z.array(entity).nullable(),
});

/** /types/ (sonda barata para `/api/health?deep=1`). */
export const comicVineTypesSchema = z.looseObject({
  ...envelope,
  results: z.array(z.looseObject({})),
});
