import * as React from "react";
import { cn } from "@/lib/utils/index";
import type { SalaPosterRatio } from "./SalaPoster";
import { SalaWorkCardSkeleton, type SalaWorkCardVariant } from "./SalaWorkCard";
import { SalaWorkListStatus } from "./SalaWorkListStatus";

/**
 * Lista de obras de «Sala» (fase 8.4): la lista de verdad alrededor de unas
 * `SalaWorkCard`, sea rejilla, lista de filas o lista compacta. No sabe nada
 * de datos: recibe las tarjetas como hijos y un `loading`.
 *
 * - **Pone la lista.** Un `<ul role="list">` (o `<ol>` con `ordered`) y un
 *   `<li>` por hijo. La forma (columnas, huecos) la da `className`.
 * - **Anuncia la carga una vez.** Mientras `loading`, la lista lleva
 *   `aria-busy` y una región viva dice `loadingLabel`; al acabar dice
 *   `loadedLabel` («12 obras»). La región está montada siempre y nace vacía,
 *   así que los dos avisos son cambios y el lector de pantalla los lee. Para
 *   eso el componente tiene que **seguir montado** antes y después de la carga
 *   (no cambiarlo por otro al llegar los datos).
 * - **Los esqueletos no cuentan.** Van al final, cada uno en un `<li>` oculto
 *   a los lectores de pantalla: la lista no anuncia elementos vacíos.
 *
 * La lista necesita nombre: `aria-label` o `aria-labelledby` (el encabezado
 * que tiene encima). `ref` y las props nativas llegan a la lista. Devuelve dos
 * hermanos, la lista y la región viva (que no ocupa sitio).
 *
 * Sin `"use client"`. Lo único de cliente es la región viva.
 */
export interface SalaWorkListProps extends Omit<React.HTMLAttributes<HTMLUListElement | HTMLOListElement>, "aria-busy"> {
  /** `<ol>`: el orden cuenta (un ranking). */
  ordered?: boolean;
  /** Se están pidiendo obras: las primeras o más. */
  loading?: boolean;
  /** Lo que se anuncia al empezar la carga, ya traducido («Cargando tu biblioteca»). */
  loadingLabel: string;
  /** Lo que se anuncia al acabar, ya traducido («12 obras»). Sin él, la región se vacía. */
  loadedLabel?: string;
  /** Cuántos esqueletos se pintan mientras `loading`, después de las tarjetas que ya haya. */
  skeletons?: number;
  /** Forma de los esqueletos: la de las tarjetas de la lista. */
  variant?: SalaWorkCardVariant;
  /** Proporción del póster de los esqueletos. */
  ratio?: SalaPosterRatio;
  /** Clases de cada `<li>`. */
  itemClassName?: string;
  /** Las tarjetas. Cada hijo va en su `<li>`; su `key` se conserva. */
  children?: React.ReactNode;
}

export const SalaWorkList = React.forwardRef<HTMLUListElement | HTMLOListElement, SalaWorkListProps>(function SalaWorkList(
  {
    ordered = false,
    loading = false,
    loadingLabel,
    loadedLabel,
    skeletons = 0,
    variant = "grid",
    ratio = "2/3",
    itemClassName,
    className,
    children,
    ...props
  },
  ref
) {
  const Lista = (ordered ? "ol" : "ul") as "ul";
  const item = cn("min-w-0", itemClassName);

  return (
    <>
      <Lista
        ref={ref as React.Ref<HTMLUListElement>}
        // Con `list-style: none` Safari deja de anunciarla como lista: se lo decimos.
        role="list"
        data-sala-list={variant}
        aria-busy={loading || undefined}
        className={cn("list-none", className)}
        {...props}
      >
        {React.Children.map(children, (hijo) =>
          hijo === null || hijo === undefined || typeof hijo === "boolean" ? null : <li className={item}>{hijo}</li>
        )}
        {loading
          ? Array.from({ length: skeletons }, (_, i) => (
              <li key={`sala-esqueleto-${i}`} aria-hidden="true" data-sala-list-skeleton="" className={item}>
                <SalaWorkCardSkeleton variant={variant} ratio={ratio} />
              </li>
            ))
          : null}
      </Lista>
      <SalaWorkListStatus loading={loading} loadingLabel={loadingLabel} loadedLabel={loadedLabel} />
    </>
  );
});
