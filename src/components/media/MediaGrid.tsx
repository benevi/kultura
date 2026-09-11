import { cn } from "@/lib/utils/index";
import type { MediaItem } from "@/types/media";
import { MediaCard } from "./MediaCard";

export interface MediaGridProps {
  items: MediaItem[];
  loading?: boolean;
  emptyMessage?: string;
  showType?: boolean;
  className?: string;
  /**
   * 'bento' (F3b): tamaños de card variables en vez de grid uniforme, lenguaje
   * visual del mockup F0/Discover. Default 'uniform' — no cambia el comportamiento
   * de los consumidores existentes (Library, Lists, Profile) fuera del alcance de F3b.
   */
  layout?: "uniform" | "bento";
  /** Match score real por item (F3a). Ausente = MediaCard no muestra badge para ese item. */
  matchScores?: Map<string, number>;
}

// Patrón bento: ciclo de 6 celdas. Cadenas literales completas (no interpoladas)
// para que Tailwind las detecte estáticamente en el análisis de contenido.
// Exportado para que el skeleton de carga de DiscoverClient use el mismo patrón
// (evita un layout shift entre skeleton y grid real).
export const BENTO_CELL_CLASSES = [
  "col-span-2 md:col-span-5 md:row-span-2",
  "col-span-1 md:col-span-4 md:row-span-2",
  "col-span-1 md:col-span-3 md:row-span-2",
  "col-span-1 md:col-span-4 md:row-span-1",
  "col-span-1 md:col-span-4 md:row-span-1",
  "col-span-2 md:col-span-4 md:row-span-1",
];

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
  showType = false,
  className,
  layout = "uniform",
  matchScores,
}: MediaGridProps) {
  const gridClasses = cn(
    layout === "bento"
      ? "grid grid-cols-2 md:grid-cols-12 auto-rows-[130px] md:auto-rows-[150px] grid-flow-row-dense gap-3"
      : "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3",
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
      {items.map((item, index) => (
        <div
          key={item.id}
          className={layout === "bento" ? BENTO_CELL_CLASSES[index % BENTO_CELL_CLASSES.length] : undefined}
        >
          <MediaCard
            item={item}
            showType={showType}
            matchScore={matchScores?.get(item.id)}
            aspect={layout === "bento" ? "fill" : "2/3"}
          />
        </div>
      ))}
    </div>
  );
}
