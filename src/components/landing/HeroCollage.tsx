// ============================================================
// KULTURA — Collage del hero de la landing (E-LANDING-SHOWCASE)
//
// Antes: tres bloques de gradiente con un icono dentro. Ahora: tres portadas
// REALES del catálogo (tipos distintos, ver `pickShowcase`) en la misma
// disposición, con las mismas rotaciones y el mismo badge colgante lime que
// ya tenía — solo cambia el relleno de las piezas.
//
// Si no hay portadas (proveedor caído, primera carga sin caché) se pinta la
// versión de gradientes: el diseño no depende de una API para sostenerse.
// ============================================================

import {
  IconLibrary,
  IconSparkles,
  IconLists,
  type KIcon,
} from "@/components/icons";
import { PosterTile, STICKER_SHADOW } from "@/components/landing/PosterTile";
import type { ShowcaseItem } from "@/lib/landing/showcase";

/** Posición, rotación y tamaño de cada pieza — idénticos en las dos versiones. */
const SLOTS = [
  {
    position: "left-0 top-10 w-32 md:w-44",
    rotation: "rotate-[-6deg]",
    gradient: "linear-gradient(155deg, var(--accent-pink), var(--on-accent-pink))",
    icon: IconLibrary as KIcon,
    iconTone: "text-on-accent-pink",
  },
  {
    position: "right-0 top-0 w-32 md:w-44",
    rotation: "rotate-[5deg]",
    gradient: "linear-gradient(155deg, var(--accent-purple), var(--on-accent-purple))",
    icon: IconSparkles as KIcon,
    iconTone: "text-on-accent-purple",
  },
  {
    position: "left-1/2 -translate-x-1/2 bottom-0 w-32 md:w-44",
    rotation: "rotate-[-2deg]",
    gradient: "linear-gradient(155deg, var(--accent-lime), var(--on-accent-lime))",
    icon: IconLists as KIcon,
    iconTone: "text-on-accent-lime",
  },
] as const;

/** Nº de portadas que consume el collage. */
export const HERO_COLLAGE_SLOTS = SLOTS.length;

export interface HeroCollageProps {
  items: ShowcaseItem[];
  /** Texto del badge colgante ("7 formatos culturales"). */
  badge: string;
}

export function HeroCollage({ items, badge }: HeroCollageProps) {
  const posters = items.slice(0, HERO_COLLAGE_SLOTS);
  const hasPosters = posters.length === HERO_COLLAGE_SLOTS;

  return (
    <div
      className="relative h-80 sm:h-96 md:h-[430px] mx-auto w-full max-w-[320px] md:max-w-sm hidden sm:block"
      aria-hidden="true"
    >
      {SLOTS.map((slot, i) =>
        hasPosters ? (
          <PosterTile
            key={slot.position}
            item={posters[i]}
            sizes="(max-width: 768px) 128px, 176px"
            priority={i === 2}
            className={`absolute ${slot.position} ${slot.rotation}`}
            style={{ boxShadow: STICKER_SHADOW }}
          />
        ) : (
          <div
            key={slot.position}
            className={`absolute ${slot.position} aspect-[2/3] rounded-bento ${slot.rotation} flex items-center justify-center`}
            style={{ background: slot.gradient }}
          >
            <slot.icon
              className={`w-9 h-9 md:w-10 md:h-10 ${slot.iconTone} opacity-70`}
            />
          </div>
        )
      )}

      {/* Badge colgante: pill de color vivo + sombra dura tipo pegatina, el
          mismo patrón que el badge de match de MediaCard/MediaDetail. */}
      <div
        className="absolute top-[22%] right-0 translate-x-1/4 rotate-[-8deg] rounded-full bg-accent-lime text-on-accent-lime text-xs font-display font-extrabold px-3 py-1.5 leading-none whitespace-nowrap"
        style={{ boxShadow: "4px 4px 0 rgba(0,0,0,.4)" }}
      >
        {badge}
      </div>
    </div>
  );
}

/**
 * Tira de portadas para móvil, donde el collage no cabe (y antes no había NADA:
 * el hero móvil era solo texto). Misma proporción y radio que el collage, en
 * fila y con rotación alterna del set (±1-1.2deg).
 */
export function HeroStrip({ items }: { items: ShowcaseItem[] }) {
  const posters = items.slice(0, 4);
  if (posters.length < 4) return null;

  return (
    <div
      className="sm:hidden flex items-center justify-center gap-3 pt-10"
      aria-hidden="true"
    >
      {posters.map((item, i) => (
        <PosterTile
          key={item.id}
          item={item}
          sizes="80px"
          className={`w-[78px] shrink-0 ${i % 2 === 0 ? "rotate-[-1.2deg]" : "rotate-[1deg]"}`}
          style={{ boxShadow: STICKER_SHADOW }}
        />
      ))}
    </div>
  );
}
