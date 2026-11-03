// ============================================================
// KULTURA — Entrada a los rankings: las páginas de control del año (cian)
//
// La página del final del álbum, la de «me falta / la tengo»: por cada
// ranking del año, los cinco primeros en orden con su casilla, su nota del
// proveedor (8,7) y el enlace al ranking entero. Debajo, los rankings de los
// años anteriores (SEO-9: la portada enlaza a todos los publicados). Sin
// datos, cada página de control queda con su título y su enlace.
// ============================================================

import { AlbumPage } from "@/components/album/AlbumPage";
import { NumberBadge } from "@/components/album/NumberBadge";
import { BEST_FORMATS, bestItemPath, type BestFormat, type BestItem } from "@/lib/best/best-of";
import { formatScore } from "@/lib/design/format";

export interface RankingChecklistProps {
  /** Prefijo de idioma de los enlaces (`/es`): `<a>` y no el `Link` (REN-9). */
  basePath: string;
  locale: string;
  year: number;
  heading: string;
  cta: string;
  /** Título largo de cada ranking, ya traducido. */
  titles: Record<BestFormat, string>;
  /** «nota 8,7 de 10» para el lector (plantilla con `{rating}`). */
  ratingLabel: string;
  tops?: Partial<Record<BestFormat, BestItem[]>>;
  previous?: {
    label: string;
    years: { year: number; links: { format: BestFormat; label: string; title: string }[] }[];
  };
}

const LINK =
  "rounded-lg underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

export function RankingChecklist({
  basePath,
  locale,
  year,
  heading,
  cta,
  titles,
  ratingLabel,
  tops = {},
  previous,
}: RankingChecklistProps) {
  return (
    <AlbumPage tone="cyan" aria-labelledby="rankings-title" className="py-16 md:py-24">
      <h2 id="rankings-title" className="mb-8 text-balance font-display text-3xl text-text-primary md:mb-12 md:text-4xl">
        {heading}
      </h2>
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {BEST_FORMATS.map((format) => {
          const top = (tops[format] ?? []).slice(0, 5);
          return (
            <li key={format} className="theme-paper flex flex-col rounded-2xl border-2 border-album-navy p-5">
              <h3 className="text-balance font-display text-2xl text-text-primary">{titles[format]}</h3>
              {top.length > 0 ? (
                <ol className="mt-4 flex flex-col">
                  {top.map((item, i) => (
                    <li key={item.id} className="flex items-center gap-3 border-t-2 border-surface-border py-2">
                      <NumberBadge n={i + 1} size="sm" tone="navy" />
                      <span aria-hidden="true" className="h-4 w-4 shrink-0 rounded-cromo border-2 border-album-navy" />
                      <a href={`${basePath}${bestItemPath(item)}`} className={`min-w-0 flex-1 truncate text-sm font-semibold text-text-primary ${LINK}`}>
                        {item.title}
                      </a>
                      {typeof item.rating === "number" ? (
                        <span className="shrink-0 text-sm tabular-nums text-text-secondary">
                          <span aria-hidden="true">{formatScore(item.rating, locale)}</span>
                          <span className="sr-only">{ratingLabel.replace("{rating}", formatScore(item.rating, locale))}</span>
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : null}
              <a
                href={`${basePath}/best/${format}/${year}`}
                className={`mt-auto inline-flex min-h-11 items-center pt-3 text-sm font-semibold text-text-primary underline ${LINK} hover:no-underline`}
              >
                {cta}
                <span className="sr-only">: {titles[format]}</span>
              </a>
            </li>
          );
        })}
      </ul>

      {previous && previous.years.length > 0 ? (
        <nav aria-labelledby="rankings-previous" className="mt-10">
          <h3 id="rankings-previous" className="mb-4 font-display text-2xl text-text-primary">
            {previous.label}
          </h3>
          <ul className="flex flex-col gap-3">
            {previous.years.map((y) => (
              <li key={y.year} className="flex flex-wrap items-center gap-2">
                <span className="w-14 shrink-0 font-numeral text-lg tabular-nums text-text-primary">{y.year}</span>
                {y.links.map((l) => (
                  <a
                    key={l.format}
                    href={`${basePath}/best/${l.format}/${y.year}`}
                    aria-label={l.title}
                    className="inline-flex min-h-11 items-center rounded-full border-2 border-album-navy bg-album-white px-4 text-sm font-semibold text-album-navy transition-colors duration-fast hover:bg-album-navy hover:text-album-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  >
                    {l.label}
                  </a>
                ))}
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </AlbumPage>
  );
}
