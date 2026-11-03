import type { MediaStatus } from "@/types/media";
import { formatSince } from "@/lib/design/format";
import { cn } from "@/lib/utils/index";

export interface StatusBandProps {
  status: MediaStatus;
  /** Nombre del estado ya traducido (`album.status.<estado>`). */
  label: string;
  /** Última vez que se tocó el título (cambio de estado, progreso, nota). */
  touchedAt?: Date | string | number | null;
  /** Idioma de la fecha relativa («hace 3 días» / «3 days ago»). */
  locale: string;
  /** «Ahora» de referencia (tests, o el del servidor para no desajustar). */
  now?: number;
  className?: string;
}

/**
 * La banda de un hueco: su estado y los días desde que lo tocaste
 * («En curso · hace 3 días»). La fecha va en `<time>` con `dateTime`; como
 * el texto depende del reloj, lleva `suppressHydrationWarning` (WIG).
 */
export function StatusBand({ status, label, touchedAt, locale, now, className }: StatusBandProps) {
  const time = touchedAt == null ? null : new Date(touchedAt);
  const valid = time !== null && Number.isFinite(time.getTime());
  return (
    <p
      data-status={status}
      className={cn(
        "flex h-6 min-w-0 items-center gap-1.5 rounded-cromo bg-surface-elevated px-2 text-xs",
        className
      )}
    >
      <span className="shrink-0 font-semibold text-text-primary">{label}</span>
      {valid ? (
        <>
          <span aria-hidden="true" className="text-text-tertiary">
            ·
          </span>
          <time dateTime={time.toISOString()} suppressHydrationWarning className="truncate text-text-tertiary">
            {formatSince(time, locale, now)}
          </time>
        </>
      ) : null}
    </p>
  );
}
