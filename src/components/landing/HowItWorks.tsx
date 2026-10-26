// ============================================================
// KULTURA — "Así funciona" en la landing (CRE-10, DIS-15)
//
// Tres pasos (buscar, apuntar y puntuar, compartir), cada uno con una
// composición que reproduce la pieza real de la app con portadas reales:
// la caja de búsqueda de la cabecera (44 px, radio 16, `--surface-elevated`),
// el chip de estado activo (color vivo + texto on-color) con las estrellas de
// nota, y los avatares apilados con una lista. Todo con primitivos de
// DISENO.md; sin portadas, cada pieza cae a su gradiente.
// ============================================================

import { IconSearch, IconStar } from "@/components/icons";
import { ArtPoster } from "@/components/landing/ArtPoster";
import type { PosterTileProps } from "@/components/landing/PosterTile";
import { F0 } from "@/lib/design/f0-tokens";
import { cn } from "@/lib/utils/index";

type Poster = PosterTileProps["item"];

export type StepKey = "find" | "track" | "share";
export const STEP_KEYS: StepKey[] = ["find", "track", "share"];

export interface HowItWorksProps {
  heading: string;
  steps: Record<StepKey, { title: string; desc: string }>;
  /** Etiqueta del chip de estado del paso 2 (p. ej. "Completado"). */
  statusLabel: string;
  /** Texto de la caja de búsqueda cuando no hay portadas (el placeholder real). */
  searchPlaceholder: string;
  /** Portadas reales de la muestra; vacío = gradientes. */
  posters?: Poster[];
}

/** Las composiciones toman portadas a partir de la 10 (las 0-9 son de features). */
const OFFSET = 10;

const NUMBER_TONE: Record<StepKey, string> = {
  find: "bg-accent-pink text-on-accent-pink",
  track: "bg-accent-lime text-on-accent-lime",
  share: "bg-accent-purple text-on-accent-purple",
};

const AVATARS: Array<[string, string]> = [
  [F0.pink, F0.purple],
  [F0.lime, F0.blue],
  [F0.orange, F0.pink],
];

function FindArt({ p, placeholder }: { p: (i: number) => Poster | null; placeholder: string }) {
  const query = p(0)?.title;
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="flex h-11 items-center gap-2 rounded-2xl bg-surface-elevated px-4 text-sm text-text-secondary">
        <IconSearch className="h-4 w-4 shrink-0" />
        <span className={cn("truncate", query && "text-text-primary")}>{query ?? placeholder}</span>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {[0, 1, 2].map((i) => (
          <ArtPoster key={i} item={p(i)} seed={`find-${i}`} sizes="96px" />
        ))}
      </div>
    </div>
  );
}

function TrackArt({ p, status }: { p: (i: number) => Poster | null; status: string }) {
  return (
    <div aria-hidden="true" className="flex flex-wrap items-end gap-4">
      <div className="w-24 shrink-0" style={{ rotate: "-3deg" }}>
        <ArtPoster item={p(3)} seed="track-0" sizes="96px" />
      </div>
      <div className="flex flex-col gap-3 pb-1">
        <span className="self-start rounded-full bg-accent-lime px-3 py-1 text-meta font-bold text-on-accent-lime">
          {status}
        </span>
        <span className="flex gap-0.5 text-accent-highlight">
          {[0, 1, 2, 3, 4].map((i) => (
            <IconStar key={i} className={cn("h-5 w-5", i === 4 && "text-surface-border")} />
          ))}
        </span>
      </div>
    </div>
  );
}

/**
 * Avatares + lista. A 768 px la card de tres columnas mide ~165 px por dentro
 * y la composición (~230 px) desbordaba la PÁGINA 8 px: ahora la lista baja a
 * otra línea y la card recorta lo que sobre (`overflow-hidden`).
 */
function ShareArt({ p }: { p: (i: number) => Poster | null }) {
  return (
    <div aria-hidden="true" className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <div className="flex">
        {AVATARS.map(([a, b], i) => (
          <span
            key={i}
            className="h-9 w-9 rounded-full"
            style={{ background: `linear-gradient(135deg, ${a}, ${b})`, border: `2px solid ${F0.bg}`, marginLeft: i ? -12 : 0 }}
          />
        ))}
      </div>
      <div className="relative h-24 w-32">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute w-14"
            style={{ left: `${i * 34}px`, top: i === 1 ? 0 : 8, rotate: `${(i - 1) * 7}deg`, zIndex: i === 1 ? 2 : 1 }}
          >
            <ArtPoster item={p(4 + i)} seed={`share-${i}`} sizes="64px" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function HowItWorks({ heading, steps, statusLabel, searchPlaceholder, posters = [] }: HowItWorksProps) {
  const p = (i: number): Poster | null => posters[OFFSET + i] ?? null;
  const ART: Record<StepKey, React.ReactNode> = {
    find: <FindArt p={p} placeholder={searchPlaceholder} />,
    track: <TrackArt p={p} status={statusLabel} />,
    share: <ShareArt p={p} />,
  };
  return (
    <section aria-labelledby="how-title" className="page-grid pb-20 md:pb-28">
      <h2
        id="how-title"
        className="font-display text-4xl md:text-6xl font-extrabold tracking-[-0.03em] text-text-primary mb-12 max-w-[14ch]"
      >
        {heading}
      </h2>
      <ol className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {STEP_KEYS.map((key, i) => (
          <li key={key} className="flex min-w-0 flex-col gap-6 overflow-hidden rounded-bento bg-surface-default p-7">
            <span
              aria-hidden="true"
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-2xl font-display text-xl font-extrabold",
                NUMBER_TONE[key]
              )}
            >
              {i + 1}
            </span>
            <div className="flex min-h-[9.5rem] flex-col justify-center">{ART[key]}</div>
            <div>
              <h3 className="font-display text-xl font-extrabold tracking-tight text-text-primary mb-2 text-balance">
                {steps[key].title}
              </h3>
              <p className="text-sm leading-relaxed text-text-secondary max-w-[42ch]">{steps[key].desc}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
