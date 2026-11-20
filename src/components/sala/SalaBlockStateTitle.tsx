"use client";

import * as React from "react";

/**
 * Lo único de cliente de `SalaBlockState`: el encabezado, que puede recibir el
 * foco al aparecer. Cuando un `error.tsx` sustituye a la página, el foco se
 * queda en nada y el lector de pantalla no dice qué ha pasado: con `focus`, va
 * al título y lo lee, con la explicación si `describedBy` apunta a ella. No
 * lleva `role="alert"`: se oiría dos veces.
 *
 * Ese foco puesto por script cumple `:focus-visible` en Chromium cuando antes no
 * se ha usado el puntero (la carga inicial): el título pinta su anillo. Es
 * buscado: dice dónde está el foco.
 */
export function SalaBlockStateTitle({
  level,
  focus,
  describedBy,
  className,
  children,
}: {
  level: 1 | 2 | 3;
  focus: boolean;
  describedBy?: string;
  className: string;
  children: React.ReactNode;
}) {
  const titulo = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => {
    if (focus) titulo.current?.focus();
  }, [focus]);
  const Encabezado = `h${level}` as "h1" | "h2" | "h3";
  return (
    <Encabezado ref={titulo} tabIndex={focus ? -1 : undefined} aria-describedby={describedBy} className={className}>
      {children}
    </Encabezado>
  );
}
