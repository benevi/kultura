// ============================================================
// KULTURA — Fila «Top 5» de los hubs de rankings (SEO-7, D-16)
// Cinco cromos numerados que llevan a sus fichas: el hub tiene contenido
// propio (no es solo una lista de enlaces) y cada título es una puerta a la
// ficha. El enlace envuelve el cromo, así que su esquina se levanta con el
// ratón y con el foco de teclado (`.group:focus-visible .cromo`).
// ============================================================

import { Cromo } from "@/components/album/Cromo";
import { NumberBadge } from "@/components/album/NumberBadge";
import { BestPoster } from "@/components/best/BestPoster";
import { PasteOnEnter } from "@/components/best/PasteOnEnter";
import { bestItemPath, type BestItem } from "@/lib/best/best-of";
import { localeHref } from "@/lib/best/links";

export const HUB_TOP = 5;

const SIZES = "(min-width: 1152px) 200px, (min-width: 640px) 18vw, 30vw";

export function BestTopRow({
  items,
  locale,
  label,
  first = false,
}: {
  items: BestItem[];
  locale: string;
  label: string;
  /** La primera fila de la página: su primera portada es el LCP. */
  first?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <PasteOnEnter>
      <ol aria-label={label} className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:gap-5">
        {items.slice(0, HUB_TOP).map((item, i) => (
          <li key={item.id} className={i >= 3 ? "hidden sm:block" : undefined}>
            <a
              href={localeHref(locale, bestItemPath(item))}
              className="group flex flex-col gap-2 rounded-cromo focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-ring"
            >
              <span aria-hidden="true" className="relative block">
                <Cromo title={item.title} seed={item.id} sizes={SIZES}>
                  <BestPoster src={item.poster} alt={item.title} sizes={SIZES} first={first && i === 0} eager={first} />
                </Cromo>
                <NumberBadge n={i + 1} tone="navy" size="sm" className="absolute left-1.5 top-1.5 z-[3]" />
              </span>
              <span className="text-sm font-semibold leading-snug text-text-primary line-clamp-2 group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4">
                <span className="sr-only">{i + 1}. </span>
                {item.title}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </PasteOnEnter>
  );
}
