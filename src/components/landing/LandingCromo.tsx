// ============================================================
// KULTURA — Cromo de la portada (servidor)
//
// El `Cromo` del álbum con la portada nativa de la landing
// (`LandingPosterImage`, sin `next/image`: F-30, el JS de `/es` ≤ 150 KB).
// La portada entra como capa encima del respaldo de color, que el `Cromo`
// pinta SIEMPRE detrás y primero: si da 404 queda el color, nunca un hueco.
// El título va en texto para el lector; quien lo use decide si lo enseña.
// ============================================================

import { Cromo } from "@/components/album/Cromo";
import { LandingPosterImage } from "@/components/landing/LandingPosterImage";

export interface LandingCromoProps {
  title: string;
  seed: string;
  poster: string;
  sizes: string;
  priority?: boolean;
  foil?: boolean;
  /** Pieza quieta (sin la esquina que se levanta). */
  still?: boolean;
  className?: string;
}

export function LandingCromo({ title, seed, poster, sizes, priority, foil, still, className }: LandingCromoProps) {
  return (
    <Cromo title={title} seed={seed} sizes={sizes} foil={foil} still={still} className={className}>
      <LandingPosterImage src={poster} sizes={sizes} priority={priority} className="object-cover" />
      <span className="sr-only">{title}</span>
    </Cromo>
  );
}
