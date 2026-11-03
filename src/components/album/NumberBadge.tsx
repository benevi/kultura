import { cn } from "@/lib/utils/index";

export type NumberBadgeTone = "surface" | "white" | "navy" | "yellow" | "cyan";
export type NumberBadgeSize = "sm" | "md" | "lg" | "xl";

export interface NumberBadgeProps {
  /** El número del hueco o del puesto. */
  n: number | string;
  /**
   * Tinta: `surface` (por defecto, sirve de noche y en papel), `white`,
   * `navy`, y en páginas públicas `yellow` / `cyan`. En la app el amarillo y
   * el cian son solo bandas de orientación, no rellenos.
   */
  tone?: NumberBadgeTone;
  size?: NumberBadgeSize;
  /** Texto para el lector si el número solo no se entiende («Puesto 1»). */
  label?: string;
  className?: string;
}

const SIZES: Record<NumberBadgeSize, string> = {
  sm: "h-7 min-w-7 px-1.5 text-lg",
  md: "h-9 min-w-9 px-2 text-2xl",
  lg: "h-14 min-w-14 px-3 text-4xl",
  xl: "h-24 min-w-24 px-4 text-7xl",
};

const TONES: Record<NumberBadgeTone, string> = {
  surface: "bg-surface-elevated text-text-primary",
  white: "bg-album-white text-album-navy",
  navy: "bg-album-navy text-album-white",
  yellow: "bg-album-yellow text-album-ink",
  cyan: "bg-album-cyan text-album-ink",
};

/**
 * El número de un álbum en su caja redondeada (Lilita One, cifras
 * tabulares): hueco, puesto de ranking, podio.
 */
export function NumberBadge({ n, tone = "surface", size = "md", label, className }: NumberBadgeProps) {
  return (
    <span
      data-number-badge
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-cromo font-numeral leading-none",
        SIZES[size],
        TONES[tone],
        className
      )}
    >
      {label ? (
        <>
          <span aria-hidden="true">{n}</span>
          <span className="sr-only">{label}</span>
        </>
      ) : (
        n
      )}
    </span>
  );
}
