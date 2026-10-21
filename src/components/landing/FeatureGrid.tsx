// ============================================================
// KULTURA — Grid de features de la landing
//
// Cada card lleva una COMPOSICIÓN con portadas reales que cuenta lo que hace la
// función (estantería con progreso, recomendación, amigos viendo, lista
// apilada), en vez de color plano con un icono. Sin portadas (proveedor caído
// o primer pintado) cada pieza cae a su gradiente: nunca hay huecos.
// ============================================================

import { IconLibrary, IconFriends, IconLists, IconSparkles, type KIcon } from "@/components/icons";
import { ArtPoster } from "@/components/landing/ArtPoster";
import { STICKER_SHADOW, type PosterTileProps } from "@/components/landing/PosterTile";
import { cn } from "@/lib/utils/index";

type Poster = PosterTileProps["item"];

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
  /** Portadas reales de la muestra de la landing; vacío = gradientes. */
  posters?: Poster[];
}

const AVATARS: Array<[string, string]> = [
  ["var(--pink)", "var(--purple)"],
  ["var(--lime)", "var(--blue)"],
  ["var(--orange)", "var(--pink)"],
  ["var(--purple)", "var(--blue)"],
];

/** Estantería: cuatro portadas escalonadas. */
function LibraryArt({ p }: { p: (i: number) => Poster | null }) {
  const rot = ["-6deg", "3deg", "-3deg", "6deg"];
  return (
    <div aria-hidden="true" className="relative h-44 lg:absolute lg:right-6 lg:top-6 lg:bottom-6 lg:h-auto lg:w-[48%]">
      {rot.map((r, i) => (
        <div
          key={i}
          className="absolute w-[25%] transition-transform duration-base ease-standard group-hover:-translate-y-2"
          style={{ left: `${i * 25}%`, top: i % 2 ? "14%" : "0%", rotate: r }}
        >
          <ArtPoster item={p(i)} seed={`lib-${i}`} sizes="140px" />
        </div>
      ))}
    </div>
  );
}

/** Recomendación: una portada grande con la pegatina de IA colgando. */
function AiArt({ p }: { p: (i: number) => Poster | null }) {
  return (
    <div aria-hidden="true" className="relative h-56 lg:h-72 flex justify-center">
      <div className="relative h-full transition-transform duration-base ease-standard group-hover:rotate-0" style={{ rotate: "4deg" }}>
        <ArtPoster item={p(0)} seed="ai-0" sizes="220px" className="h-full" />
        <span
          className="absolute -top-3 -left-4 rounded-full bg-accent-lime px-3 py-1 text-[13px] font-extrabold text-on-accent-lime"
          style={{ rotate: "-8deg", boxShadow: STICKER_SHADOW }}
        >
          ✦ IA
        </span>
      </div>
    </div>
  );
}

/** Amigos: pila de avatares y dos portadas de lo que están viendo. */
function FriendsArt({ p }: { p: (i: number) => Poster | null }) {
  return (
    <div aria-hidden="true" className="flex items-center gap-3">
      <div className="flex">
        {AVATARS.map(([a, b], i) => (
          <span
            key={i}
            className="w-9 h-9 rounded-full"
            style={{ background: `linear-gradient(135deg, ${a}, ${b})`, border: "2px solid var(--bg)", marginLeft: i ? -12 : 0 }}
          />
        ))}
      </div>
      <div className="flex gap-2">
        {[0, 1].map((i) => (
          <ArtPoster key={i} item={p(i)} seed={`fr-${i}`} sizes="64px" className="w-11" style={{ rotate: i ? "5deg" : "-5deg" }} />
        ))}
      </div>
    </div>
  );
}

/** Listas: tres portadas apiladas como una colección. */
function ListsArt({ p }: { p: (i: number) => Poster | null }) {
  return (
    <div aria-hidden="true" className="relative h-20 w-28">
      {[0, 1, 2].map((i) => (
        <div key={i} className="absolute w-12" style={{ left: `${i * 28}px`, top: i === 1 ? 0 : 6, rotate: `${(i - 1) * 7}deg`, zIndex: i === 1 ? 2 : 1 }}>
          <ArtPoster item={p(i)} seed={`li-${i}`} sizes="64px" />
        </div>
      ))}
    </div>
  );
}

function featureBackground(hue: number): string {
  return `radial-gradient(120% 100% at 20% 10%, oklch(68% 0.2 ${hue} / 0.58), transparent 55%), linear-gradient(160deg, oklch(42% 0.15 ${hue}), oklch(22% 0.06 ${hue}))`;
}

export function FeatureGrid({ features, posters = [] }: FeatureGridProps) {
  // Cada card toma portadas DISTINTAS de la muestra (que ya empieza variada).
  const pick = (offset: number) => (i: number): Poster | null => posters[offset + i] ?? null;
  const ART: Record<FeatureKey, React.ReactNode> = {
    library: <LibraryArt p={pick(0)} />,
    ai: <AiArt p={pick(4)} />,
    friends: <FriendsArt p={pick(5)} />,
    lists: <ListsArt p={pick(7)} />,
  };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-5">
      {FEATURE_KEYS.map((key) => {
        const { icon: Icon, iconBg, iconText, cell, hue, rotate } = FEATURE_LAYOUT[key];
        const big = hue !== undefined;
        return (
          <article
            key={key}
            className={cn(
              "group relative overflow-hidden rounded-bento p-7 flex flex-col justify-between gap-6",
              "transition-transform duration-base ease-standard hover:rotate-0",
              big ? "text-text-primary" : "bg-surface-default",
              cell,
              rotate
            )}
            style={big ? { background: featureBackground(hue) } : undefined}
          >
            {big ? (
              <>
                <div className={cn("relative z-10 w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", iconBg)}>
                  <Icon className={cn("w-6 h-6", iconText)} />
                </div>
                {ART[key]}
              </>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", iconBg)}>
                  <Icon className={cn("w-6 h-6", iconText)} />
                </div>
                {ART[key]}
              </div>
            )}
            <div className={cn("relative z-10", key === "library" && "lg:max-w-[46%]")}>
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
