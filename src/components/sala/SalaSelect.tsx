"use client";

import * as React from "react";
import { cn } from "@/lib/utils/index";
import { SALA_CONTROL, SALA_CONTROL_STATE, SalaField, salaControlState, type SalaFieldTexts } from "./SalaField";

/**
 * Desplegable de «Sala» (fase 8.4). Un `<select>` nativo dentro de
 * `SalaField`: el teclado, el lector de pantalla y la lista del móvil son los
 * del sistema. Solo se dibuja la caja y la flecha.
 *
 * Las opciones son sus hijos (`<option>`), con el texto ya traducido. Para
 * «elige una», una primera opción vacía y `required`.
 */
export interface SalaSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement>, SalaFieldTexts {
  fieldClassName?: string;
}

export const SalaSelect = React.forwardRef<HTMLSelectElement, SalaSelectProps>(function SalaSelect(
  { label, requirement, hint, error, id, className, fieldClassName, required, disabled, children, "aria-describedby": describedBy, ...props },
  ref
) {
  return (
    <SalaField
      id={id}
      label={label}
      requirement={requirement}
      hint={hint}
      error={error}
      required={required}
      describedBy={describedBy}
      className={fieldClassName}
    >
      {(control) => (
        <div className="relative min-w-0">
          <select
            ref={ref}
            {...control}
            required={required}
            disabled={disabled}
            className={cn(
              SALA_CONTROL,
              "pr-11",
              // La lista que abre el navegador, con los colores de «Sala».
              "[&>option]:bg-sala-background [&>option]:text-sala-ink",
              SALA_CONTROL_STATE[salaControlState({ disabled, invalid: control["aria-invalid"] })],
              !disabled && "cursor-pointer",
              className
            )}
            {...props}
          >
            {children}
          </select>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="square"
            className={cn(
              "pointer-events-none absolute right-3 top-[14px] h-5 w-5 forced-colors:text-[color:FieldText]",
              disabled ? "text-sala-ink-disabled" : "text-sala-ink"
            )}
          >
            <path d="M5 8l5 5 5-5" />
          </svg>
        </div>
      )}
    </SalaField>
  );
});
