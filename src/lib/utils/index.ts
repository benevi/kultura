/**
 * Combina clases CSS de forma condicional.
 * Alternativa ligera a clsx/cn sin dependencias extra.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
