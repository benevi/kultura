"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/index";
import type { MediaItem } from "@/types/media";

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
  // Badge de tipo (modo "all", R5b): label localizado vía discoverFilters.typeBadge
  // (singular, ≠ filters.<type> que es plural). R6.
  const tBadge = useTranslations("discoverFilters.typeBadge");

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
              verde del DS. Label localizado vía discoverFilters.typeBadge. */}
          {showType && (
            <div
              data-testid="media-type-badge"
              className="absolute top-2 left-2 text-[10px] font-medium bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-white leading-none shadow-md ring-1 ring-accent-positive/40"
            >
              {tBadge(item.type)}
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
