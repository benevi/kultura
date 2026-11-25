/**
 * «Sorpréndeme» (F-25, PRO-6): índice al azar distinto de `previous` (si hay
 * más de uno). Lo comparten `TonightClient` (Inicio de hoy) y
 * `SalaHomeTonight` (Inicio en «Sala»).
 */
export function pickIndex(length: number, previous: number | null, random: () => number = Math.random): number {
  if (length <= 1) return 0
  let next = Math.floor(random() * length)
  if (next === previous) next = (next + 1) % length
  return next
}
