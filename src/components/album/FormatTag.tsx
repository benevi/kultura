import type { MediaType } from "@/types/media";
import { FORMAT_COLOR } from "@/lib/design/album";
import { cn } from "@/lib/utils/index";

export interface FormatTagProps {
  format: MediaType;
  /**
   * Nombre del formato ya traducido (`album.format.<tipo>`). Obligatorio: el
   * color de formato nunca va solo (DISENO.md, WCAG 1.4.1).
   */
  label: string;
  className?: string;
}

/** Punto del color del formato + su nombre. */
export function FormatTag({ format, label, className, ...rest }: FormatTagProps & { "data-testid"?: string }) {
  return (
    <span
      data-format={format}
      className={cn("inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-text-secondary", className)}
      {...rest}
    >
      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: FORMAT_COLOR[format] }} />
      <span className="truncate">{label}</span>
    </span>
  );
}
