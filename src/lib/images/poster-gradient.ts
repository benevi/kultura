import { cromoPlaceholder } from "@/lib/design/album";

/**
 * Respaldo de color para portadas sin imagen (o mientras cargan): el del
 * álbum de cromos (`cromoPlaceholder`, DISENO.md), dos paradas del mismo
 * matiz tomadas de las tintas del álbum, nunca gris plano ni violeta. Se
 * conserva el nombre para quien ya lo usa; en código nuevo, `Cromo`.
 */
export function posterGradient(seed: string): string {
  return cromoPlaceholder(seed);
}
