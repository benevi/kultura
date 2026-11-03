import type { MediaType } from "@/types/media";
import { FORMAT_COLOR } from "@/lib/design/album";
import { cn } from "@/lib/utils/index";

export interface SlotProps {
  /** Número del hueco en la página. */
  number: number | string;
  /** Título impreso en pequeño dentro del hueco. */
  title: string;
  /** Formato: la pestaña de la esquina va en su color. */
  format?: MediaType;
  /** Nombre del formato (obligatorio si hay `format`: el color no va solo). */
  formatLabel?: string;
  /** Texto para el lector antes del título («Hueco 12, pendiente:»). */
  label?: string;
  /** Un `Cromo` que ocupa el hueco (pegado o puesto). */
  children?: React.ReactNode;
  /** Banda de estado bajo el hueco (`StatusBand`). */
  band?: React.ReactNode;
  className?: string;
}

/**
 * El hueco numerado del álbum (pendiente): 2:3, contorno discontinuo de
 * 2 px (marino al 40 % en papel, blanco al 28 % de noche, `--slot-line`),
 * número arriba a la izquierda en Lilita One y el título impreso en pequeño
 * dentro. Con `children`, el cromo ocupa el hueco.
 */
export function Slot({ number, title, format, formatLabel, label, children, band, className }: SlotProps) {
  const filled = children != null && children !== false;
  return (
    <div data-slot="" data-filled={filled ? "" : undefined} className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div
        className={cn(
          "relative aspect-[2/3] w-full rounded-cromo",
          filled ? null : "border-2 border-dashed border-slot-line"
        )}
      >
        {filled ? (
          <div className="absolute inset-0">{children}</div>
        ) : (
          <>
            <span aria-hidden="true" className="absolute left-2 top-1.5 font-display text-lg leading-none tabular-nums text-text-secondary">
              {number}
            </span>
            <span className="absolute inset-x-2 top-1/2 line-clamp-3 -translate-y-1/2 text-balance text-center text-xs font-medium text-text-tertiary">
              {label ? <span className="sr-only">{label} </span> : null}
              {title}
            </span>
            {format ? (
              <span
                aria-hidden="true"
                data-tab={format}
                className="absolute right-0 top-0 h-3 w-3 rounded-bl-cromo"
                style={{ backgroundColor: FORMAT_COLOR[format] }}
              />
            ) : null}
            {format && formatLabel ? <span className="sr-only">{formatLabel}</span> : null}
          </>
        )}
      </div>
      {band}
    </div>
  );
}
