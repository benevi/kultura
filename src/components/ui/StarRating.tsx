'use client'

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/index";
import { useRadioGroupKeys } from "@/components/ui/useRadioGroupKeys";

export interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Nombre del grupo (interactivo). Alternativa: `aria-labelledby`. */
  label?: string;
  "aria-labelledby"?: string;
}

const MAX = 5;
const STARS = [1, 2, 3, 4, 5] as const;

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

function StarIcon({
  filled,
  className,
}: {
  filled: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      className={className}
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

/**
 * Puntuación de 1 a 5 (ACC-8).
 * - Interactiva: patrón `radiogroup` — una sola parada de Tab, ←/→ (y ↑/↓,
 *   Inicio, Fin) cambian la nota, anillo de foco visible y cada estrella se
 *   anuncia "3 estrellas" en el idioma de la página.
 * - Solo lectura: una imagen con nombre "3 de 5" (antes el lector no oía nada).
 */
export function StarRating({
  value,
  onChange,
  size = "md",
  className,
  label,
  "aria-labelledby": labelledBy,
}: StarRatingProps) {
  const t = useTranslations("common");
  const [hovered, setHovered] = useState<number | null>(null);
  const { getItemProps } = useRadioGroupKeys(STARS, value, (v) => onChange?.(v));

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
            <StarIcon
              filled={star <= value}
              className={cn(
                sizeClasses[size],
                star <= value ? "text-accent-highlight" : "text-muted"
              )}
            />
          </span>
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
        <button
          key={star}
          type="button"
          data-star={star}
          {...getItemProps(star, i)}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          aria-label={t("stars", { count: star })}
          className={cn(
            "rounded-full",
            hitClasses[size],
            "focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring"
          )}
        >
          <StarIcon
            filled={star <= displayValue}
            className={cn(
              sizeClasses[size],
              star <= displayValue ? "text-accent-highlight" : "text-muted",
              "transition-colors"
            )}
          />
        </button>
      ))}
    </div>
  );
}
