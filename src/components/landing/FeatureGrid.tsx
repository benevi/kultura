// ============================================================
// KULTURA — Grid de features de la landing
//
// Tarjeta = icono centrado + título + descripción. Sin ilustración: las
// miniaturas de portada que hubo aquí competían con el collage del hero y
// dejaban la tarjeta abarrotada, así que el catálogo se enseña ARRIBA (hero)
// y estas tarjetas solo explican.
// ============================================================

import { IconLibrary, IconFriends, IconLists, IconSparkles, type KIcon } from "@/components/icons";
import { cn } from "@/lib/utils/index";

/** Claves de feature de la landing, en el orden en que se pintan. */
export type FeatureKey = "library" | "friends" | "lists" | "ai";

// Acentos DECORATIVOS (F7) — mismo criterio que Logo/MediaCard: variedad
// visual sin rol semántico, un color distinto por feature (sin patrón, solo
// para no repetir accent-positive fuera de su rol interactivo).
const FEATURE_ACCENTS: { icon: KIcon; bg: string; text: string }[] = [
  { icon: IconLibrary, bg: "bg-accent-pink", text: "text-on-accent-pink" },
  { icon: IconFriends, bg: "bg-accent-lime", text: "text-on-accent-lime" },
  { icon: IconLists, bg: "bg-accent-purple", text: "text-on-accent-purple" },
  { icon: IconSparkles, bg: "bg-accent-orange", text: "text-on-accent-orange" },
];

export const FEATURE_KEYS: FeatureKey[] = ["library", "friends", "lists", "ai"];

export interface FeatureGridProps {
  /** Título + descripción por feature, ya traducidos. */
  features: Record<FeatureKey, { title: string; desc: string }>;
}

export function FeatureGrid({ features }: FeatureGridProps) {
  return (
    // 4 columnas solo a partir de lg: a md las cuatro tarjetas dejaban el
    // texto en columnas de dos palabras.
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {FEATURE_KEYS.map((key, i) => {
        const { icon: Icon, bg, text } = FEATURE_ACCENTS[i];
        // Rotación sutil alternada — solo en el grid desktop, solo las piezas
        // del bento (F0 §Rotación de cards). Se endereza al hover.
        const rotate = i % 2 === 0 ? "lg:rotate-[-1.2deg]" : "lg:rotate-[1deg]";
        return (
          <div
            key={key}
            className={cn(
              "bg-surface-default border border-surface-border rounded-bento p-6 flex flex-col items-center text-center gap-4",
              "transition-transform duration-base ease-standard hover:rotate-0",
              rotate
            )}
          >
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0", bg)}>
              <Icon className={cn("w-7 h-7", text)} />
            </div>
            <div>
              <h3 className="font-display font-bold text-text-primary mb-1.5">
                {features[key].title}
              </h3>
              <p className="text-text-secondary text-sm leading-relaxed">
                {features[key].desc}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
