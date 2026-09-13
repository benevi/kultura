import Image from "next/image";
import { cn } from "@/lib/utils/index";
import { AVATAR_ICONS } from "@/components/icons/avatars";

export interface AvatarProps {
  initials: string;
  color?: string;
  size?: "sm" | "md" | "lg";
  src?: string;
  className?: string;
  /**
   * Clave del catálogo de personajes (`AVATAR_ICONS`). Ausente o desconocida →
   * iniciales, que es lo que tienen las cuentas anteriores a esta función.
   */
  icon?: string | null;
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

/** El personaje ocupa ~60% del círculo: deja aire suficiente para leerse a 32px. */
const iconSizeClasses: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "w-5 h-5",
  md: "w-6 h-6",
  lg: "w-8 h-8",
};

const LEGACY_RED = "#E82020";

export function Avatar({
  initials,
  color = "var(--surface-elevated)",
  size = "md",
  src,
  className,
  icon,
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

  // E-AVATAR-ICONS: el personaje se pinta en `currentColor` sobre el mismo
  // fondo de siempre, así que el color elegido por el usuario sigue mandando.
  // Sin icono (o con una clave que ya no exista en el catálogo) se cae a las
  // iniciales: las cuentas anteriores a esta función no cambian.
  const IconComponent = icon ? AVATAR_ICONS[icon] : undefined;

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center flex-shrink-0 font-medium text-white select-none",
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: resolvedColor }}
    >
      {IconComponent ? (
        <IconComponent className={iconSizeClasses[size]} aria-hidden="true" />
      ) : (
        initials
      )}
    </div>
  );
}
