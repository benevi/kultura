// ============================================================
// KULTURA — Rankings "Lo mejor de {año}" en la landing
//
// Entrada a las páginas públicas /best/[formato]/[año]. Mismos primitivos que
// el bento de features (card de radio bento, gradiente de un matiz + acento
// radial de F0); nada de formas nuevas. Cada card es UN enlace entero.
// ============================================================

import { Link } from "@/i18n/navigation";
import { BEST_FORMATS, type BestFormat } from "@/lib/best/best-of";
import { cn } from "@/lib/utils/index";

/** Matiz de la paleta por formato (F0: pink, orange, blue, lime). */
const HUE: Record<BestFormat, number> = { anime: 350, movie: 55, tv: 250, game: 130 };

function background(hue: number): string {
  return `radial-gradient(120% 100% at 20% 10%, oklch(68% 0.2 ${hue} / 0.58), transparent 55%), linear-gradient(160deg, oklch(42% 0.15 ${hue}), oklch(22% 0.06 ${hue}))`;
}

export interface BestRankingsProps {
  year: number;
  heading: string;
  sub: string;
  cta: string;
  /** Etiqueta corta y título largo por formato, ya traducidos. */
  copy: Record<BestFormat, { label: string; title: string }>;
}

export function BestRankings({ year, heading, sub, cta, copy }: BestRankingsProps) {
  return (
    <section className="px-4 md:px-8 pb-20 md:pb-28 max-w-6xl mx-auto">
      <h2 className="font-display text-4xl md:text-6xl font-extrabold tracking-[-0.03em] text-text-primary mb-4 max-w-[14ch]">
        {heading}
      </h2>
      <p className="text-text-secondary text-base mb-12 max-w-[52ch]">{sub}</p>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {BEST_FORMATS.map((format) => (
          <li key={format}>
            <Link
              href={`/best/${format}/${year}`}
              className={cn(
                "group h-full min-h-[220px] rounded-bento p-6 flex flex-col justify-between gap-8 text-text-primary",
                "transition-transform duration-base ease-standard hover:-translate-y-1",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink"
              )}
              style={{ background: background(HUE[format]) }}
            >
              <span className="self-start rounded-full bg-surface-elevated px-3 py-1 text-[12px] font-bold">
                {copy[format].label}
              </span>
              <span>
                <span className="block font-display text-2xl font-extrabold tracking-tight text-balance mb-3">
                  {copy[format].title}
                </span>
                <span className="text-[14px] font-bold">
                  {cta} <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-1">→</span>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
