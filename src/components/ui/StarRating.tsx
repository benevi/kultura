'use client'

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/index";
import { useRadioGroupKeys } from "@/components/ui/useRadioGroupKeys";
import { playStarCascade } from "@/lib/library/motion";

export interface StarRatingProps {
  /** Estrellas de 0 a 5 (0 = sin nota). Con `step={0.5}`, en medias. */
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Nombre del grupo (interactivo). Alternativa: `aria-labelledby`. */
  label?: string;
  "aria-labelledby"?: string;
  /**
   * 1 (por defecto): estrellas enteras, como siempre. 0,5: medias estrellas
   * (F-24, D-14): cada estrella tiene dos mitades pulsables y el grupo tiene
   * 10 opciones ("0,5 estrellas" … "5 estrellas").
   */
  step?: 1 | 0.5;
}

const MAX = 5;
const STARS = [1, 2, 3, 4, 5] as const;
const HALF_VALUES = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

const sizeClasses: Record<NonNullable<StarRatingProps["size"]>, string> = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
};

/** Relleno alrededor de la estrella: zona táctil de 24 / 32 / 44 px. */
const hitClasses: Record<NonNullable<StarRatingProps["size"]>, string> = {
  sm: "p-1",
  md: "p-1.5",
  lg: "p-2.5",
};

/**
 * En medias estrellas cada mitad es un objetivo: la estrella mide 48 px para
 * que cada mitad llegue a 24 × 48 (WCAG 2.5.8) sea cual sea el tamaño.
 */
const halfHitClasses: Record<NonNullable<StarRatingProps["size"]>, string> = {
  sm: "p-4",
  md: "p-3.5",
  lg: "p-3",
};

const FOCUS_RING =
  "focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring";

const POLYGON =
  "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2";

type Fill = "full" | "half" | "none";

function fillFor(star: number, value: number): Fill {
  if (value >= star) return "full";
  if (value >= star - 0.5) return "half";
  return "none";
}

function StarIcon({ fill, className }: { fill: Fill; className?: string }) {
  if (fill === "half") {
    // Media estrella: contorno apagado + la mitad izquierda rellena encima.
    // Mismo tamaño que una entera: cambiar de nota no mueve nada (CLS 0).
    return (
      <span className={cn("relative inline-block", className)} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="absolute inset-0 h-full w-full text-muted">
          <polygon points={POLYGON} />
        </svg>
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth={2}
          className="absolute inset-0 h-full w-full text-accent-highlight [clip-path:inset(0_50%_0_0)]"
        >
          <polygon points={POLYGON} />
        </svg>
      </span>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill={fill === "full" ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      className={cn(className, fill === "full" ? "text-accent-highlight" : "text-muted")}
      aria-hidden="true"
    >
      <polygon points={POLYGON} />
    </svg>
  );
}

/**
 * Puntuación de 1 a 5, o de ½ a 5 en medias (ACC-8, F-24).
 * - Interactiva: patrón `radiogroup` — una sola parada de Tab, ←/→ (y ↑/↓,
 *   Inicio, Fin) cambian la nota, anillo de foco visible y cada opción se
 *   anuncia "3 estrellas" / "3,5 estrellas" en el idioma de la página.
 * - Solo lectura: una imagen con nombre "3 de 5" / "3,5 de 5".
 * - Al elegir nota, las estrellas se rellenan en cascada (40 ms entre una y
 *   otra, ≤ 300 ms, solo `transform`); nada con movimiento reducido (DIS-14).
 */
export function StarRating({
  value,
  onChange,
  size = "md",
  className,
  label,
  "aria-labelledby": labelledBy,
  step = 1,
}: StarRatingProps) {
  const t = useTranslations("common");
  const [hovered, setHovered] = useState<number | null>(null);
  const iconRefs = useRef<Array<HTMLElement | null>>([]);
  const half = step === 0.5;
  const values: readonly number[] = half ? HALF_VALUES : STARS;

  function commit(next: number) {
    onChange?.(next);
    playStarCascade(iconRefs.current.slice(0, Math.ceil(next)));
  }
  const { getItemProps } = useRadioGroupKeys(values, value, (v) => commit(v));

  const isInteractive = onChange !== undefined;
  const displayValue = hovered ?? value;

  if (!isInteractive) {
    return (
      <div
        role="img"
        aria-label={value > 0 ? t("ratingOf", { value, max: MAX }) : t("notRated")}
        className={cn("flex items-center gap-0.5", className)}
      >
        {STARS.map((star) => (
          <span key={star} data-star={star}>
            <StarIcon fill={fillFor(star, value)} className={sizeClasses[size]} />
          </span>
        ))}
      </div>
    );
  }

  if (!half) {
    return (
      <div
        role="radiogroup"
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        className={cn("flex items-center", className)}
        onMouseLeave={() => setHovered(null)}
      >
        {STARS.map((star, i) => (
          <button
            key={star}
            type="button"
            data-star={star}
            {...getItemProps(star, i)}
            onClick={() => commit(star)}
            onMouseEnter={() => setHovered(star)}
            aria-label={t("stars", { count: star })}
            className={cn("rounded-full", hitClasses[size], FOCUS_RING)}
          >
            <span ref={(el) => { iconRefs.current[i] = el; }} className="block">
              <StarIcon
                fill={star <= displayValue ? "full" : "none"}
                className={cn(sizeClasses[size], "transition-colors")}
              />
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      className={cn("flex items-center", className)}
      onMouseLeave={() => setHovered(null)}
    >
      {STARS.map((star, i) => (
        <span key={star} data-star={star} className={cn("relative block rounded-full", halfHitClasses[size])}>
          <span ref={(el) => { iconRefs.current[i] = el; }} className="block">
            <StarIcon fill={fillFor(star, displayValue)} className={sizeClasses[size]} />
          </span>
          {([star - 0.5, star] as const).map((option, side) => (
            <button
              key={option}
              type="button"
              data-value={option}
              {...getItemProps(option, i * 2 + side)}
              onClick={() => commit(option)}
              onMouseEnter={() => setHovered(option)}
              aria-label={t("stars", { count: option })}
              className={cn(
                "absolute inset-y-0 w-1/2",
                side === 0 ? "left-0 rounded-l-full" : "right-0 rounded-r-full",
                FOCUS_RING
              )}
            />
          ))}
        </span>
      ))}
    </div>
  );
}
