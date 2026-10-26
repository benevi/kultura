// ============================================================
// KULTURA — Fila "Top 5" de los hubs de rankings (SEO-7, D-16)
// Cinco pósteres que llevan a sus fichas: el hub tiene contenido propio (no
// es solo una lista de enlaces) y cada título es una puerta a la ficha.
// ============================================================

import { BestPoster } from "@/components/best/BestPoster";
import { posterGradient } from "@/lib/images/poster-gradient";
import { bestItemPath, type BestItem } from "@/lib/best/best-of";
import { localeHref } from "@/lib/best/links";

export const HUB_TOP = 5;

export function BestTopRow({ items, locale, label }: { items: BestItem[]; locale: string; label: string }) {
  if (items.length === 0) return null;
  return (
    <ol aria-label={label} className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:gap-5">
      {items.slice(0, HUB_TOP).map((item, i) => (
        <li key={item.id} className={i >= 3 ? "hidden sm:block" : undefined}>
          <a
            href={localeHref(locale, bestItemPath(item))}
            className="group flex flex-col gap-2 rounded-2xl focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <span
              aria-hidden="true"
              className="relative block aspect-[2/3] w-full overflow-hidden rounded-2xl"
              style={{ background: posterGradient(item.id) }}
            >
              <BestPoster src={item.poster} alt={item.title} sizes="(min-width: 896px) 160px, (min-width: 640px) 18vw, 30vw" />
            </span>
            <span className="text-meta font-bold leading-snug text-text-primary line-clamp-2 group-hover:text-accent-pink transition-colors">
              <span className="text-text-tertiary">{i + 1}. </span>
              {item.title}
            </span>
          </a>
        </li>
      ))}
    </ol>
  );
}
