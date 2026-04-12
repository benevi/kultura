import { useState } from "react";
import { cn } from "@/lib/utils/index";

export interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses: Record<NonNullable<StarRatingProps["size"]>, string> = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
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

export function StarRating({
  value,
  onChange,
  size = "md",
  className,
}: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const isInteractive = onChange !== undefined;
  const displayValue = hovered ?? value;

  if (!isInteractive) {
    return (
      <div className={cn("flex items-center gap-0.5", className)}>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} data-star={i + 1}>
            <StarIcon
              filled={i < value}
              className={cn(
                sizeClasses[size],
                i < value ? "text-accent" : "text-muted"
              )}
            />
          </span>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      onMouseLeave={() => setHovered(null)}
    >
      {Array.from({ length: 5 }, (_, i) => {
        const starValue = i + 1;
        return (
          <button
            key={i}
            type="button"
            data-star={starValue}
            onClick={() => onChange(starValue)}
            onMouseEnter={() => setHovered(starValue)}
            aria-label={`${starValue} estrella${starValue !== 1 ? "s" : ""}`}
            className="focus:outline-none"
          >
            <StarIcon
              filled={i < displayValue}
              className={cn(
                sizeClasses[size],
                i < displayValue ? "text-accent" : "text-muted",
                "transition-colors"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
