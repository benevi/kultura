"use client";

import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/index";
import type { MediaItem, MediaType } from "@/types/media";

// Label del tipo para el badge (modo "all", E59 R5b). Placeholder i18n: las
// claves reales por tipo entran en R6 (mismo plan que humanizeKey en la barra).
const TYPE_LABEL: Record<MediaType, string> = {
  movie: "Película",
  tv: "Serie",
  anime: "Anime",
  book: "Libro",
  manga: "Manga",
  game: "Videojuego",
  comic: "Cómic",
};

export interface MediaCardProps {
  item: MediaItem;
  showType?: boolean;
  priority?: boolean;
  className?: string;
}

export function MediaCard({
  item,
  showType = false,
  priority = false,
  className,
}: MediaCardProps) {
  const href = `/media/${item.type}/${item.externalId}` as const;

  return (
    <Link href={href} className={cn("block", className)}>
      <article className="group flex flex-col rounded-lg overflow-hidden cursor-pointer">
        {/* Poster */}
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-surface2 rounded-lg">
          {item.poster ? (
            <Image
              src={item.poster}
              alt={item.title}
              fill
              sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, 16vw"
              className="object-cover group-hover:scale-105 transition-transform duration-200"
              priority={priority}
            />
          ) : (
            <div
              data-placeholder
              className="absolute inset-0 flex items-center justify-center bg-surface2"
            >
              <span className="text-muted text-xs font-medium line-clamp-2 px-2 text-center">
                {item.title.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}

          {/* Type badge overlay (modo "all", R5b): esquina superior, acento
              verde del DS. Label localizado vía TYPE_LABEL (placeholder, R6). */}
          {showType && (
            <div className="absolute top-2 left-2 text-[10px] font-medium bg-accent-positive/90 backdrop-blur-sm px-1.5 py-0.5 rounded text-on-accent-positive leading-none">
              {TYPE_LABEL[item.type] ?? item.type}
            </div>
          )}

          {/* Rating overlay */}
          {item.rating !== undefined && (
            <div className="absolute bottom-2 right-2 text-[10px] bg-bg/80 px-1.5 py-0.5 rounded text-amber-400 leading-none">
              ★ {item.rating.toFixed(1)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 pb-1 px-0.5 flex flex-col gap-0.5">
          <h3
            className="text-xs font-medium line-clamp-2 text-text leading-tight"
            title={item.title}
          >
            {item.title}
          </h3>
          {item.year && (
            <p className="text-[10px] text-muted">{item.year}</p>
          )}
        </div>
      </article>
    </Link>
  );
}
