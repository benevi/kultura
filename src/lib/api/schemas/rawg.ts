// Contratos MÍNIMOS de RAWG (COD-1). `metacritic`, `ratings_count`, `genres`…
// quedan opcionales a propósito: RAWG ya dejó de mandar `metacritic` en los
// listados una vez y eso no debe tumbar el catálogo (lo vigila el contrato
// semanal, `tests/contract/rawg.contract.test.ts`).
import { z } from "zod";

const game = z.looseObject({ id: z.number(), name: z.string() });

/** /games (búsqueda, catálogo, rankings). */
export const rawgListSchema = z.looseObject({
  results: z.array(game),
  count: z.number().optional(),
  next: z.string().nullish(),
});

/** /games/{id}. */
export const rawgDetailSchema = game;

/** /genres (sonda barata para `/api/health?deep=1`). */
export const rawgGenresSchema = z.looseObject({
  results: z.array(z.looseObject({})),
});
