// ============================================================
// KULTURA — Grid de features de la landing
//
// Sin portadas a propósito: las miniaturas que hubo aquí competían con el
// hero, así que el catálogo se enseña ARRIBA y estas tarjetas solo explican.
// ============================================================

import { IconLibrary, IconFriends, IconLists, IconSparkles, type KIcon } from "@/components/icons";
import { cn } from "@/lib/utils/index";

/** Claves de feature de la landing, en el orden en que se pintan. */
export type FeatureKey = "library" | "friends" | "lists" | "ai";

/**
 * Bento ASIMÉTRICO (E-LANDING-INMERSIVA, pase anti-genérico). Antes eran cuatro
 * tarjetas iguales con el icono centrado: el patrón de feature-row más típico
 * de una web hecha en serie. Ahora dos piezas grandes (biblioteca, IA) llevan
 * la fórmula de card "feature" de F0 —gradiente de un matiz + acento radial—
 * y rotación alterna; las otras dos son superficie plana. Texto a la izquierda.
 */
const FEATURE_LAYOUT: Record<
  FeatureKey,
  { icon: KIcon; iconBg: string; iconText: string; cell: string; hue?: number; rotate?: string }
> = {
  library: {
    icon: IconLibrary,
    iconBg: "bg-accent-pink",
    iconText: "text-on-accent-pink",
    cell: "sm:col-span-2 lg:col-span-4 min-h-[260px]",
    hue: 350,
    rotate: "lg:rotate-[-1.2deg]",
  },
  ai: {
    icon: IconSparkles,
    iconBg: "bg-accent-lime",
    iconText: "text-on-accent-lime",
    cell: "sm:col-span-2 lg:col-span-2 lg:row-span-2 min-h-[260px]",
    hue: 300,
    rotate: "lg:rotate-[1deg]",
  },
  friends: {
    icon: IconFriends,
    iconBg: "bg-accent-orange",
    iconText: "text-on-accent-orange",
    cell: "lg:col-span-2",
  },
  lists: {
    icon: IconLists,
    iconBg: "bg-accent-purple",
    iconText: "text-on-accent-purple",
    cell: "lg:col-span-2",
  },
};

export const FEATURE_KEYS: FeatureKey[] = ["library", "ai", "friends", "lists"];

export interface FeatureGridProps {
  /** Título + descripción por feature, ya traducidos. */
  features: Record<FeatureKey, { title: string; desc: string }>;
}

function featureBackground(hue: number): string {
  return `radial-gradient(120% 100% at 20% 10%, oklch(68% 0.2 ${hue} / 0.58), transparent 55%), linear-gradient(160deg, oklch(42% 0.15 ${hue}), oklch(22% 0.06 ${hue}))`;
}

export function FeatureGrid({ features }: FeatureGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-5">
      {FEATURE_KEYS.map((key) => {
        const { icon: Icon, iconBg, iconText, cell, hue, rotate } = FEATURE_LAYOUT[key];
        const big = hue !== undefined;
        return (
          <article
            key={key}
            className={cn(
              "rounded-bento p-7 flex flex-col justify-between gap-10",
              "transition-transform duration-base ease-standard hover:rotate-0",
              big ? "text-text-primary" : "bg-surface-default",
              cell,
              rotate
            )}
            style={big ? { background: featureBackground(hue) } : undefined}
          >
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", iconBg)}>
              <Icon className={cn("w-6 h-6", iconText)} />
            </div>
            <div>
              <h3
                className={cn(
                  "font-display font-extrabold text-text-primary tracking-tight text-balance",
                  big ? "text-3xl md:text-4xl mb-3" : "text-xl mb-2"
                )}
              >
                {features[key].title}
              </h3>
              <p className={cn("leading-relaxed max-w-[42ch]", big ? "text-text-primary opacity-90 text-base" : "text-text-secondary text-sm")}>
                {features[key].desc}
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
