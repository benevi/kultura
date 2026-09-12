import Image from "next/image";
import { cn } from "@/lib/utils/index";

export interface AvatarProps {
  initials: string;
  color?: string;
  size?: "sm" | "md" | "lg";
  src?: string;
  className?: string;
}

const sizeClasses: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-base",
};

const sizePixels: Record<NonNullable<AvatarProps["size"]>, number> = {
  sm: 32,
  md: 40,
  lg: 56,
};

const LEGACY_RED = "#E82020";

export function Avatar({
  initials,
  color = "var(--surface-elevated)",
  size = "md",
  src,
  className,
}: AvatarProps) {
  const px = sizePixels[size];
  const resolvedColor =
    color === LEGACY_RED ? "var(--accent-positive)" : color;

  if (src) {
    return (
      <div
        className={cn(
          "relative rounded-full overflow-hidden flex-shrink-0",
          sizeClasses[size],
          className
        )}
      >
        <Image
          src={src}
          alt={initials}
          width={px}
          height={px}
          className="object-cover w-full h-full"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center flex-shrink-0 font-medium text-white select-none",
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: resolvedColor }}
    >
      {initials}
    </div>
  );
}
