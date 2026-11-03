import type { MediaType } from "@/types/media";
import { FORMAT_COLOR } from "@/lib/design/album";
import { cn } from "@/lib/utils/index";

export interface ProgressStripProps {
  /** Avance de 0 a 1 (episodio, capítulo, página u horas sobre el total). */
  value: number;
  /** Formato del título: decide el color de la tira (dato, DISENO.md). */
  format?: MediaType;
  /**
   * Texto para el lector («Episodio 4 de 10»), ya traducido. Va oculto a la
   * vista: la tira es la forma visual del mismo dato. Sin él, la tira es
   * decorativa (el dato tiene que estar escrito en otra parte).
   */
  label?: string;
  className?: string;
}

/**
 * Tira de progreso al pie de un cromo «en curso»: pista en tinta marina y
 * relleno en el color del formato. El relleno crece con `transform` (no
 * con el ancho), así que un cambio de valor no mueve la maquetación.
 */
export function ProgressStrip({ value, format, label, className }: ProgressStripProps) {
  const v = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  return (
    <span data-progress-strip className={cn("block", className)}>
      <span aria-hidden="true" className="block h-1.5 w-full overflow-hidden bg-album-ink/70">
        <span
          className="block h-full w-full origin-left transition-transform duration-base ease-out"
          style={{
            transform: `scaleX(${v})`,
            backgroundColor: format ? FORMAT_COLOR[format] : "var(--text-primary)",
          }}
        />
      </span>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
