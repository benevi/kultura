// ============================================================
// KULTURA — Ilustración de cada tarjeta de features (E-LANDING-SHOWCASE)
//
// Cada feature se enseña con el primitivo F0 que le corresponde, usando
// portadas REALES del catálogo en vez de describirla solo con texto:
//   biblioteca → pila de portadas solapadas (estante)
//   amigos     → avatares apilados (F0 §Avatares apilados)
//   listas     → fila de portadas pequeñas
//   IA         → portada + pill lime, la misma pegatina del badge de match
//
// El pill de la card de IA lleva texto real ("Para ti"), no un porcentaje
// inventado: un match sin biblioteca detrás sería un dato falso.
//
// Sin portadas en la muestra, cada ilustración se retira y la tarjeta se queda
// como estaba (icono + texto). Nunca bloquea el render.
// ============================================================

import {
  PosterRow,
  PosterStack,
  PosterTile,
  StackedAvatars,
  STICKER_SHADOW,
} from "@/components/landing/PosterTile";
import type { ShowcaseItem } from "@/lib/landing/showcase";

/** Claves de feature de la landing, en el orden en que se pintan. */
export type FeatureKey = "library" | "friends" | "lists" | "ai";

/** Cuántas portadas consume la ilustración de cada feature. */
export const FEATURE_POSTER_COST: Record<FeatureKey, number> = {
  library: 3,
  friends: 0,
  lists: 3,
  ai: 1,
};

export interface FeatureVisualProps {
  feature: FeatureKey;
  /** Portadas ya reservadas para ESTA feature (ver FEATURE_POSTER_COST). */
  items: ShowcaseItem[];
  /** Etiqueta del pill de la card de IA. */
  aiBadge: string;
}

export function FeatureVisual({ feature, items, aiBadge }: FeatureVisualProps) {
  if (feature === "friends") return <StackedAvatars />;

  if (items.length < FEATURE_POSTER_COST[feature]) return null;

  if (feature === "library") return <PosterStack items={items} />;
  if (feature === "lists") return <PosterRow items={items} />;

  return (
    <div className="relative">
      <PosterTile item={items[0]} radius="card" sizes="72px" className="w-[54px]" />
      <div
        className="absolute -top-2 -right-3 rotate-[-8deg] rounded-full bg-accent-lime text-on-accent-lime text-[10px] font-display font-extrabold px-2 py-1 leading-none whitespace-nowrap"
        style={{ boxShadow: STICKER_SHADOW }}
      >
        {aiBadge}
      </div>
    </div>
  );
}
