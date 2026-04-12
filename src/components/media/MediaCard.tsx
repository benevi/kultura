import Image from "next/image";
import { cn } from "@/lib/utils/index";
import type { MediaItem } from "@/types/media";
import { Badge } from "@/components/ui/Badge";
import { ImageIcon } from "lucide-react";

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
  return (
    <article
      className={cn(
        "group flex flex-col rounded-lg overflow-hidden bg-surface2 border border-border",
        "transition-transform duration-200 hover:scale-[1.02]",
        className
      )}
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-surface2">
        {item.poster ? (
          <Image
            src={item.poster}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
            className="object-cover transition-opacity duration-300 group-hover:opacity-90"
            priority={priority}
          />
        ) : (
          <div
            data-placeholder
            className="absolute inset-0 flex items-center justify-center bg-surface2"
          >
            <ImageIcon className="w-10 h-10 text-muted opacity-40" />
          </div>
        )}

        {/* Type badge overlay */}
        {showType && (
          <div className="absolute top-2 left-2">
            <Badge variant="accent">{item.type}</Badge>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-bg/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      </div>

      {/* Footer */}
      <div className="p-2 flex flex-col gap-0.5">
        <h3
          className="text-text text-sm font-medium leading-tight line-clamp-2"
          title={item.title}
        >
          {item.title}
        </h3>
        <div className="flex items-center gap-2 text-muted text-xs">
          {item.year && <span>{item.year}</span>}
          {item.rating !== undefined && (
            <span className="flex items-center gap-0.5">
              <span className="text-accent">★</span>
              <span>
                {item.rating.toFixed(1)}
                {item.ratingSource && (
                  <span className="text-muted/60 ml-0.5">{item.ratingSource}</span>
                )}
              </span>
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
