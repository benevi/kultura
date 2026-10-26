// ============================================================
// KULTURA — Fondo quieto del hero de la landing (E-LANDING-SHOWCASE, D-11)
//
// Cuando no hay galería WebGL (reducir movimiento, ahorro de datos, equipo
// modesto, sin WebGL) el hero se queda con:
//   - escritorio (≥ lg): collage de tres portadas REALES rotadas, a la derecha;
//   - móvil (< md): una tira de cuatro portadas bajo los botones.
// Mismo radio, misma sombra de pegatina y rotaciones del set (DISENO.md).
//
// Sin portadas (proveedor caído, primera carga sin caché) el collage se pinta
// con gradientes y la tira no se pinta: el diseño no depende de una API.
// ============================================================

import {
  IconLibrary,
  IconSparkles,
  IconLists,
  type KIcon,
} from "@/components/icons";
import { PosterTile, STICKER_SHADOW, fallbackGradient } from "@/components/landing/PosterTile";
import type { ShowcaseItem } from "@/lib/landing/showcase";

/** Posición, rotación y tamaño de cada pieza — idénticos en las dos versiones. */
const SLOTS = [
  {
    position: "left-0 top-12 w-52",
    rotation: "rotate-[-6deg]",
    gradient: "linear-gradient(155deg, var(--accent-pink), var(--on-accent-pink))",
    icon: IconLibrary as KIcon,
    iconTone: "text-on-accent-pink",
  },
  {
    position: "right-0 top-0 w-52",
    rotation: "rotate-[5deg]",
    gradient: "linear-gradient(155deg, var(--accent-purple), var(--on-accent-purple))",
    icon: IconSparkles as KIcon,
    iconTone: "text-on-accent-purple",
  },
  {
    position: "left-1/2 -translate-x-1/2 bottom-0 w-52",
    rotation: "rotate-[-2deg]",
    gradient: "linear-gradient(155deg, var(--accent-lime), var(--on-accent-lime))",
    icon: IconLists as KIcon,
    iconTone: "text-on-accent-lime",
  },
] as const;

/** Nº de portadas que consume el collage. */
export const HERO_COLLAGE_SLOTS = SLOTS.length;

/** Collage de escritorio (decorativo). */
export function HeroCollage({ items }: { items: ShowcaseItem[] }) {
  const posters = items.slice(0, HERO_COLLAGE_SLOTS);
  const hasPosters = posters.length === HERO_COLLAGE_SLOTS;

  return (
    <div className="relative h-[540px] w-[28rem]" aria-hidden="true">
      {SLOTS.map((slot, i) =>
        hasPosters ? (
          <PosterTile
            key={slot.position}
            item={posters[i]}
            sizes="208px"
            className={`absolute ${slot.position} ${slot.rotation}`}
            style={{ boxShadow: STICKER_SHADOW }}
          />
        ) : (
          <div
            key={slot.position}
            className={`absolute ${slot.position} aspect-[2/3] rounded-2xl ${slot.rotation} flex items-center justify-center`}
            style={{ background: slot.gradient }}
          >
            <slot.icon className={`w-10 h-10 ${slot.iconTone} opacity-70`} />
          </div>
        )
      )}
    </div>
  );
}

/**
 * Tira de portadas para móvil. Las cuatro piezas reparten el ancho disponible
 * (rejilla de 4 columnas, como mucho 76 px cada una): a 320 px caben sin
 * desbordar la página, que con piezas fijas de 72 px se salía 15 px.
 */
const STRIP = "mt-10 grid max-w-[22rem] grid-cols-4 gap-2.5 px-1 md:hidden";
const STRIP_ROTATION = (i: number) => (i % 2 === 0 ? "rotate-[-1.2deg]" : "rotate-[1deg]");

/**
 * Hueco de la tira mientras llega la muestra (y si no llega): mismas
 * medidas y bloques de color de la paleta. Sin él, la tira entraba después
 * del primer pintado y empujaba toda la página 158 px hacia abajo en móvil
 * (CLS 0,07 bajo el hero, en la sección de funciones).
 */
export function HeroStripPlaceholder() {
  return (
    <div className={STRIP} aria-hidden="true">
      {["a", "b", "c", "d"].map((seed, i) => (
        <div
          key={seed}
          className={`aspect-[2/3] rounded-2xl shadow-sticker ${STRIP_ROTATION(i)}`}
          style={{ background: fallbackGradient(`strip-${seed}`) }}
        />
      ))}
    </div>
  );
}

export function HeroStrip({ items }: { items: ShowcaseItem[] }) {
  const posters = items.slice(0, 4);
  // Con menos de 4 portadas, el hueco reservado: la altura no cambia nunca.
  if (posters.length < 4) return <HeroStripPlaceholder />;

  return (
    <div
      className="mt-10 grid max-w-[22rem] grid-cols-4 gap-2.5 px-1 md:hidden"
      aria-hidden="true"
    >
      {posters.map((item, i) => (
        <PosterTile
          key={item.id}
          item={item}
          radius="card"
          sizes="80px"
          className={i % 2 === 0 ? "rotate-[-1.2deg]" : "rotate-[1deg]"}
          style={{ boxShadow: STICKER_SHADOW }}
        />
      ))}
    </div>
  );
}
