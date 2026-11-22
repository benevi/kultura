import type { ReactNode } from "react";
import { cn } from "@/lib/utils/index";

/**
 * Una sección de la mitad de abajo de la ficha con «Sala» (F2c): su `h2`
 * (visible, o solo para el lector con `hiddenHeading`) y lo de dentro. El
 * `id` del encabezado nombra la sección (`aria-labelledby`), así que cada una
 * sale en la lista de regiones y de encabezados del lector de pantalla.
 */
export function SalaFichaSection({
  id,
  heading,
  hiddenHeading = false,
  className,
  children,
  ...props
}: {
  id: string;
  heading: string;
  hiddenHeading?: boolean;
  className?: string;
  children: ReactNode;
} & Record<`data-${string}`, string>) {
  return (
    <section aria-labelledby={id} className={cn("min-w-0", className)} {...props}>
      <h2 id={id} className={hiddenHeading ? "sr-only" : "sala-type-heading mb-5"}>
        {heading}
      </h2>
      {children}
    </section>
  );
}
