// ============================================================
// KULTURA — Lista del ranking público (Server Component)
// Primitivos de DISENO.md: card con radio 20, gradiente de respaldo detrás de
// la portada, chips de género. Sin enlaces a /media: la ficha exige sesión.
// ============================================================

import { PosterImage } from "@/components/media/PosterImage";
import { posterGradient } from "@/lib/images/poster-gradient";
import type { BestItem } from "@/lib/best/best-of";

export function BestOfList({ items, label }: { items: BestItem[]; label: string }) {
  return (
    <ol aria-label={label} className="flex flex-col gap-5">
      {items.map((item, i) => (
        <li
          key={item.id}
          className="flex gap-5 rounded-20 bg-surface-default p-4 md:p-5"
        >
          <div
            className="relative w-24 md:w-32 flex-shrink-0 aspect-[2/3] overflow-hidden rounded-card"
            style={{ background: posterGradient(item.id) }}
          >
            <PosterImage
              src={item.poster}
              sizes="(min-width: 768px) 128px, 96px"
              priority={i < 3}
              className="object-cover"
            />
          </div>
          <div className="min-w-0 flex flex-col gap-2">
            <h2 className="font-display text-xl md:text-2xl font-extrabold text-text-primary">
              <span className="text-text-tertiary mr-2">{i + 1}.</span>
              {item.title}
            </h2>
            <p className="text-[13px] font-bold text-text-secondary">
              {item.year ? <span>{item.year}</span> : null}
              {item.year && item.rating ? <span aria-hidden="true"> · </span> : null}
              {item.rating ? <span>★ {item.rating.toFixed(1)}</span> : null}
            </p>
            {item.genres.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {item.genres.map((g) => (
                  <li
                    key={g}
                    className="rounded-full bg-surface-elevated px-3 py-1 text-[12px] font-bold text-text-primary"
                  >
                    {g}
                  </li>
                ))}
              </ul>
            ) : null}
            {item.synopsis ? (
              <p className="text-[14px] text-text-secondary line-clamp-3 md:line-clamp-4">
                {item.synopsis}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
