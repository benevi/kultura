import Image from "next/image";
import { cn } from "@/lib/utils/index";
import { AVATAR_ICONS } from "@/components/icons/avatars";
import { getAvatarColor } from "@/lib/constants/avatarColors";
import { readableTextOn } from "@/lib/design/color";

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
const DEFAULT_BG = "var(--surface-elevated)";

/**
 * Fondo y color de las iniciales para lo que haya guardado en `avatar_color`.
 *
 * La columna mezcla tres formatos según la época de la cuenta: un nombre de la
 * paleta (`'blue'`, lo que guarda Ajustes), un hex suelto (`'#6FCF97'`, el alta
 * antigua) o el rojo por defecto de la tabla (`#E82020`). Antes el nombre se
 * pasaba tal cual a `background-color`: `'blue'` pintaba el azul puro de CSS y
 * `'slate'` / `'amber'` no son colores CSS, así que el círculo salía vacío. Y
 * las iniciales iban siempre en blanco (1 de 8 colores pasaba 4,5:1, ACC-9).
 */
function resolveColors(color: string): { background: string; text: string } {
  const palette = getAvatarColor(color);
  if (palette) return { background: palette.value, text: palette.on };
  if (color === LEGACY_RED) {
    return { background: "var(--accent-positive)", text: "var(--on-accent-positive)" };
  }
  const readable = readableTextOn(color);
  return {
    background: color,
    text: readable === "dark" ? "var(--surface-base)" : "var(--text-primary)",
  };
}

export function Avatar({
  initials,
  color = DEFAULT_BG,
  size = "md",
  src,
  className,
  icon,
}: AvatarProps) {
  const px = sizePixels[size];
  const colors = resolveColors(color);

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
        "rounded-full flex items-center justify-center flex-shrink-0 font-medium select-none",
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: colors.background, color: colors.text }}
    >
      {initials}
    </div>
  );
}
