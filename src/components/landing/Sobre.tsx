// ============================================================
// KULTURA — El sobre de cromos (dibujo)
//
// Tinta plana de imprenta: cuerpo amarillo con el monograma (los tres cromos
// del logotipo) y la tira rosa de abrir, con el filo dentado. Con `torn`, la
// tira se levanta y se ladea: el sobre está abierto. Decorativo: lo que
// cuenta la página está en los huecos, no aquí.
// ============================================================

import { cn } from "@/lib/utils/index";

const ZIGZAG = "M2 24 L7 20 L12 24 L17 20 L22 24 L27 20 L32 24 L37 20 L42 24 L47 20 L52 24 L57 20 L62 24";

export function Sobre({ torn, className }: { torn: boolean; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      data-sobre=""
      data-torn={torn ? "" : undefined}
      viewBox="0 0 64 84"
      className={cn("h-20 w-16 shrink-0 overflow-visible md:h-24 md:w-20", className)}
    >
      {/* Cuerpo, con el filo dentado por donde se rasga. */}
      <path
        d={`${ZIGZAG} L62 80 Q62 82 60 82 L4 82 Q2 82 2 80 Z`}
        fill="var(--album-yellow)"
        stroke="var(--album-navy)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect x="2" y="68" width="60" height="14" rx="2" fill="var(--album-navy)" />
      <g transform="translate(32 46)">
        <rect x="-12" y="-14" width="17" height="12" rx="2" fill="var(--album-pink)" transform="rotate(-10)" />
        <rect x="-4" y="-7" width="17" height="12" rx="2" fill="var(--album-cyan)" transform="rotate(6)" />
        <rect x="-11" y="1" width="17" height="12" rx="2" fill="var(--album-navy)" transform="rotate(-4)" />
      </g>
      {/* Tira de abrir: se levanta al rasgar. */}
      <g
        className={cn(
          "origin-bottom-left transition-transform duration-base ease-out [transform-box:fill-box]",
          torn && "-translate-y-2 -rotate-[24deg]"
        )}
      >
        <path
          d={`M2 4 Q2 2 4 2 L60 2 Q62 2 62 4 L62 24 L57 20 L52 24 L47 20 L42 24 L37 20 L32 24 L27 20 L22 24 L17 20 L12 24 L7 20 L2 24 Z`}
          fill="var(--album-pink)"
          stroke="var(--album-navy)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
