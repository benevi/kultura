"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/index";
import { usePasteGrid } from "@/lib/motion/usePasteGrid";
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
  /**
   * E-SIN-CARDS-VACIAS: en el catálogo no se enseña ninguna card sin portada —
   * ni las que llegan sin ella ni las que fallan al cargar (se sacan de la
   * rejilla, que se recoloca). Por defecto SÍ. La biblioteca pasa `false`:
   * ahí son títulos del propio usuario y esconderlos sería perderlos; se quedan
   * con su gradiente y su título.
   */
  requirePoster?: boolean;
  /** Nivel del título de cada card (ACC-7, ver `MediaCard`). */
  headingLevel?: 2 | 3 | 4;
}

/** Cards que se cargan con prioridad: lo que se ve sin hacer scroll. */
const PRIORITY_CARDS = 6;

// Patrón bento: ciclo de 6 celdas, fila alta
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

// Álbum de cromos: sin rotación ni acento radial en las celdas grandes (sin
// degradados fuera del brillo; la portada es la que manda).

/**
 * Esqueleto con la forma real de `MediaCard` (DIS-13): póster con el radio
 * de póster y, DEBAJO, las dos líneas del título y el año. En la rejilla
 * bento (`fill`) el póster ocupa el alto que deja el título en la celda,
 * como la tarjeta de verdad: al cargar, nada salta.
 */
function ShimmerCard({ fill = false }: { fill?: boolean }) {
  return (
    <div aria-hidden="true" className={cn("motion-safe:animate-pulse", fill && "flex h-full flex-col")}>
      <div className={cn("w-full rounded-cromo bg-surface-elevated", fill ? "min-h-0 flex-1" : "aspect-[2/3]")} />
      <div className="mt-2 h-3.5 w-3/4 rounded-pill bg-surface-elevated" />
      <div className="mt-1.5 h-3 w-1/3 rounded-pill bg-surface-elevated" />
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
  requirePoster = true,
  headingLevel,
}: MediaGridProps) {
  const t = useTranslations("media");
  const [failed, setFailed] = React.useState<ReadonlySet<string>>(() => new Set());
  const onPosterError = React.useCallback(
    (id: string) => setFailed((prev) => (prev.has(id) ? prev : new Set(prev).add(id))),
    []
  );
  const gridRef = React.useRef<HTMLDivElement>(null);
  // Un pegado escalonado por rejilla y página, al montar (en la app nada va
  // ligado al scroll). GSAP se carga en ese momento; nada con movimiento
  // reducido.
  const visible = requirePoster ? items.filter((i) => i.poster && !failed.has(i.id)) : items;
  usePasteGrid(gridRef, { enabled: !loading && visible.length > 0 });
  const gridClasses = cn(
    layout === "bento"
      ? // gap-5 (20px): mismo espaciado entre cards de fila que fija DISENO.md
        // §Principio de extensión — también da holgura cómoda a la rotación
        // de las cards feature sin que se solapen con sus vecinas.
        "grid grid-cols-2 md:grid-cols-12 auto-rows-[130px] md:auto-rows-[150px] grid-flow-row-dense gap-5"
      : "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3",
    className
  );

  if (loading) {
    return (
      <div data-loading aria-busy="true" className={gridClasses}>
        {Array.from({ length: 8 }, (_, i) => (
          <ShimmerCard key={i} fill={layout === "bento"} />
        ))}
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div data-empty className="flex items-center justify-center py-16">
        <p className="text-sm text-text-tertiary">{emptyMessage ?? t("noContent")}</p>
      </div>
    );
  }

  return (
    <div ref={gridRef} className={gridClasses}>
      {visible.map((item, index) => {
        const cyclePos = index % BENTO_CELL_CLASSES.length;
        return (
          <div key={item.id} className={layout === "bento" ? BENTO_CELL_CLASSES[cyclePos] : undefined}>
            <MediaCard
              item={item}
              showType={showType}
              priority={index < PRIORITY_CARDS}
              onPosterError={requirePoster ? onPosterError : undefined}
              aspect={layout === "bento" ? "fill" : "2/3"}
              headingLevel={headingLevel}
            />
          </div>
        );
      })}
    </div>
  );
}
