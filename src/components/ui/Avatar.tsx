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

  // E-AVATAR-ICONS: cada personaje trae su propio disco con color y volumen, así
  // que ocupa el avatar entero y NO se tiñe con `avatar_color` — teñirlo era lo
  // que dejaba doce círculos iguales donde no se distinguía ninguno. El color
  // sigue mandando en la opción de iniciales, que es la otra mitad de la
  // elección. Una clave desconocida cae a las iniciales, así que retirar un
  // personaje del catálogo nunca deja el avatar vacío.
  const IconComponent = icon ? AVATAR_ICONS[icon] : undefined;

  if (IconComponent) {
    return (
      <IconComponent
        className={cn("rounded-full flex-shrink-0 select-none", sizeClasses[size], className)}
        role="img"
        aria-label={initials}
      />
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
