// ============================================================
// KULTURA — Rankings "Lo mejor de {año}" en la landing
//
// Entrada a /best/[formato]/[año]. Cada card enseña el CONTENIDO del ranking:
// las tres primeras portadas reales en abanico, con la nota y el título del
// primero. Sin datos, las portadas caen a gradiente del mismo matiz: la
// landing nunca depende de un proveedor. Mismos primitivos de F0 (card bento,
// gradiente + acento radial, sombra dura de pegatina).
//
// ACC-17: el texto ya no va ENCIMA del abanico. Hasta `lg` el abanico va arriba
// y el texto debajo, sobre la parte oscura del gradiente; desde `lg`, lado a
// lado sin solaparse. Debajo, los rankings de años anteriores (SEO-9: la
// landing enlaza a los 12 rankings publicados).
// ============================================================

import { Link } from "@/i18n/navigation";
import { ArtPoster } from "@/components/landing/ArtPoster";
import { BEST_FORMATS, type BestFormat, type BestItem } from "@/lib/best/best-of";
import { cn } from "@/lib/utils/index";

/** Matiz de la paleta por formato (F0: pink, orange, blue, lime). */
const HUE: Record<BestFormat, number> = { anime: 350, movie: 55, tv: 250, game: 130 };

/** Abanico: izquierda, giro y altura de cada una de las tres portadas. */
const FAN = [
  { left: "0%", rotate: "-9deg", bottom: "10%" },
  { left: "27%", rotate: "-1deg", bottom: "2%" },
  { left: "54%", rotate: "8deg", bottom: "12%" },
] as const;

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
  /** Primeros títulos de cada ranking (texto); ausente = versión de gradiente. */
  tops?: Partial<Record<BestFormat, BestItem[]>>;
  /** Portadas del abanico (null = gradiente); por defecto, las de `tops`. */
  fans?: Partial<Record<BestFormat, (BestItem | null)[]>>;
  /** Rankings de años anteriores (enlaces), ya traducidos. */
  previous?: {
    label: string;
    years: { year: number; links: { format: BestFormat; label: string; title: string }[] }[];
  };
}

export function BestRankings({ year, heading, sub, cta, copy, tops = {}, fans, previous }: BestRankingsProps) {
  return (
    <section aria-labelledby="rankings-title" className="px-4 md:px-8 pb-20 md:pb-28 max-w-6xl mx-auto">
      <h2
        id="rankings-title"
        className="font-display text-4xl md:text-6xl font-extrabold tracking-[-0.03em] text-text-primary mb-4 max-w-[14ch]"
      >
        {heading}
      </h2>
      <p className="text-text-secondary text-base mb-12 max-w-[52ch]">{sub}</p>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {BEST_FORMATS.map((format, i) => {
          const top = tops[format] ?? [];
          const fan = fans?.[format] ?? top;
          const first = top[0];
          return (
            <li key={format}>
              <Link
                href={`/best/${format}/${year}`}
                className={cn(
                  "group relative h-full min-h-[300px] rounded-bento overflow-hidden p-7 flex flex-col gap-6 text-text-primary",
                  "transition-transform duration-base ease-standard hover:-translate-y-1",
                  i % 2 === 0 ? "md:rotate-[-0.6deg]" : "md:rotate-[0.6deg]",
                  "hover:rotate-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
                )}
                style={{ background: background(HUE[format]) }}
              >
                <span className="relative z-10 self-start rounded-full bg-surface-elevated px-3 py-1 text-[12px] font-bold">
                  {copy[format].label}
                </span>

                {/* Abanico de portadas reales (decorativo: el título va en texto). */}
                <div
                  aria-hidden="true"
                  className="relative mx-auto h-40 w-52 lg:absolute lg:right-5 lg:top-5 lg:bottom-5 lg:mx-0 lg:h-auto lg:w-[44%]"
                >
                  {FAN.map((pos, n) => (
                    <div
                      key={n}
                      className="absolute w-[46%] transition-transform duration-base ease-standard group-hover:-translate-y-2"
                      style={{ left: pos.left, bottom: pos.bottom, rotate: pos.rotate, zIndex: n === 1 ? 2 : 1 }}
                    >
                      <ArtPoster item={fan[n] ?? null} seed={`${format}-${n}`} sizes="140px" />
                    </div>
                  ))}
                </div>

                <span className="relative z-10 mt-auto lg:max-w-[50%]">
                  <span className="block font-display text-2xl md:text-3xl font-extrabold tracking-tight text-balance mb-3">
                    {copy[format].title}
                  </span>
                  {first ? (
                    <span className="block text-[14px] mb-3 line-clamp-2">
                      {first.rating ? `★ ${first.rating.toFixed(1)} · ` : ""}
                      {first.title}
                    </span>
                  ) : null}
                  <span className="text-[14px] font-bold">
                    {cta}{" "}
                    <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-1">→</span>
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {previous && previous.years.length > 0 ? (
        <nav aria-labelledby="rankings-previous" className="mt-10">
          <h3 id="rankings-previous" className="font-display text-xl font-extrabold text-text-primary mb-4">
            {previous.label}
          </h3>
          <ul className="flex flex-col gap-3">
            {previous.years.map((y) => (
              <li key={y.year} className="flex flex-wrap items-center gap-2">
                <span className="w-14 shrink-0 font-display text-lg font-extrabold text-text-secondary">{y.year}</span>
                {y.links.map((l) => (
                  <Link
                    key={l.format}
                    href={`/best/${l.format}/${y.year}`}
                    aria-label={l.title}
                    className="inline-flex min-h-10 items-center rounded-full bg-surface-elevated px-4 text-sm font-bold text-text-primary transition-colors hover:bg-surface-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
                  >
                    {l.label}
                  </Link>
                ))}
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </section>
  );
}
