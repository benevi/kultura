import { cn } from "@/lib/utils/index";
import type { MediaItem } from "@/types/media";
import { MediaCard } from "./MediaCard";

export interface MediaGridProps {
  items: MediaItem[];
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

function ShimmerCard() {
  return (
    <div className="flex flex-col rounded-lg overflow-hidden bg-surface2 border border-border animate-pulse">
      <div className="aspect-[2/3] w-full bg-surface" />
      <div className="p-2 flex flex-col gap-2">
        <div className="h-3 bg-surface rounded w-3/4" />
        <div className="h-2 bg-surface rounded w-1/3" />
      </div>
    </div>
  );
}

export function MediaGrid({
  items,
  loading = false,
  emptyMessage,
  className,
}: MediaGridProps) {
  const gridClasses = cn(
    "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4",
    className
  );

  if (loading) {
    return (
      <div data-loading className={gridClasses}>
        {Array.from({ length: 8 }, (_, i) => (
          <ShimmerCard key={i} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div data-empty className="flex items-center justify-center py-16">
        <p className="text-muted text-sm">
          {emptyMessage ?? "No hay contenido disponible"}
        </p>
      </div>
    );
  }

  return (
    <div className={gridClasses}>
      {items.map((item) => (
        <MediaCard key={item.id} item={item} />
      ))}
    </div>
  );
}
