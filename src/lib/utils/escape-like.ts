/**
 * Escapa los comodines de `LIKE`/`ILIKE` (`%`, `_`) y la barra: buscar "%" o
 * "_" no debe convertirse en "todo" ni en un patrón caro.
 */
export function escapeLikePattern(q: string): string {
  return q.replace(/[\\%_]/g, (c) => `\\${c}`)
}
