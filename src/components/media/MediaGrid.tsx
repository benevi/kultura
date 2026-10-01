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
}

// Patrón bento F0 (CLAUDE.md §Rotación de cards): ciclo de 6 celdas, fila alta
// de 3 (5/4/3 columnas × row-span-3) + fila baja de 3 (4/4/4 columnas ×
// row-span-2) — mismo 12-col grid y proporción 3:2 que el mockup de Discover.
// Cadenas literales completas (no interpoladas) para que Tailwind las detecte
// estáticamente en el análisis de contenido.
// Exportado para que el skeleton de carga de DiscoverClient use el mismo patrón
// (evita un layout shift entre skeleton y grid real).
export const BENTO_CELL_CLASSES = [
  "col-span-2 md:col-span-5 md:row-span-3",
  "col-span-1 md:col-span-4 md:row-span-3",
  "col-span-1 md:col-span-3 md:row-span-3",
  "col-span-1 md:col-span-4 md:row-span-2",
  "col-span-1 md:col-span-4 md:row-span-2",
  "col-span-2 md:col-span-4 md:row-span-2",
];

// F0: solo las DOS primeras cards de cada ciclo de 6 ("feature grande" y
// "feature mediano") llevan rotación sutil y acento radial — las 4 restantes
// (incl. la de span-3, "pequeña" pese a compartir row-span) van sin transform.
// Signos alternos, igual que en el mockup (-1.2deg / 1deg).
const BENTO_ROTATION_CLASSES = ["-rotate-[1.2deg]", "rotate-[1deg]"];
// Matices vivos de la paleta (H de --purple/--pink/--blue/--orange, CLAUDE.md
// §Tokens) para el acento radial de esas mismas dos cards. Dos pares que se
// alternan ciclo a ciclo para que filas consecutivas no se repitan idénticas.
const BENTO_ACCENT_HUE_PAIRS: [number, number][] = [
  [300, 350], // purple, pink — igual que el mockup F0
  [250, 55], // blue, orange
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
}: MediaGridProps) {
  const gridClasses = cn(
    layout === "bento"
      ? // gap-5 (20px): mismo espaciado entre cards de fila que fija CLAUDE.md
        // §Principio de extensión — también da holgura cómoda a la rotación
        // de las cards feature sin que se solapen con sus vecinas.
        "grid grid-cols-2 md:grid-cols-12 auto-rows-[130px] md:auto-rows-[150px] grid-flow-row-dense gap-5"
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
      {items.map((item, index) => {
        const cyclePos = index % BENTO_CELL_CLASSES.length;
        const cycleIndex = Math.floor(index / BENTO_CELL_CLASSES.length);
        // Solo las dos primeras posiciones del ciclo son "feature" (F0).
        const isFeature = layout === "bento" && cyclePos < 2;
        return (
          <div
            key={item.id}
            className={cn(
              layout === "bento" ? BENTO_CELL_CLASSES[cyclePos] : undefined,
              isFeature ? BENTO_ROTATION_CLASSES[cyclePos] : undefined
            )}
          >
            <MediaCard
              item={item}
              showType={showType}
              aspect={layout === "bento" ? "fill" : "2/3"}
              accentHue={
                isFeature
                  ? BENTO_ACCENT_HUE_PAIRS[cycleIndex % BENTO_ACCENT_HUE_PAIRS.length][cyclePos]
                  : undefined
              }
            />
          </div>
        );
      })}
    </div>
  );
}
