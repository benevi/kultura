"use client";

import * as React from "react";
import { cn } from "@/lib/utils/index";
import { SalaFieldAnnouncer, SalaFieldError, SalaFieldHint, useSalaField, type SalaFieldTexts } from "./SalaField";

/**
 * Casilla de «Sala» (fase 8.4).
 *
 * Un `<input type="checkbox">` nativo (Espacio, formularios y lector de
 * pantalla, gratis) dentro de su `<label>`: la fila entera se pulsa y mide
 * 48 px o más, aunque el dibujo sea de 24. La marca es un trazo, no un color:
 * marcada, la caja se llena de tinta y lleva la marca encima.
 *
 * `ref`, `className` y el resto de props llegan al `<input>`; `fieldClassName`,
 * a la caja entera. La ayuda y el error van debajo, alineados con el texto.
 *
 * Con colores forzados (alto contraste de Windows) se devuelve la casilla del
 * sistema: es la que el sistema sabe pintar con sus colores.
 */
export interface SalaCheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "children">, SalaFieldTexts {
  fieldClassName?: string;
}

/** La fila que se pulsa: el dibujo y su texto. 48 px de alto como poco. */
export const SALA_CHOICE_ROW =
  "flex min-h-sala-target min-w-sala-target max-w-full items-start gap-3 py-3 sala-type-text [-webkit-tap-highlight-color:transparent]";

/** Con el puntero en cualquier punto de la fila, el borde del dibujo pasa a tinta. */
export const SALA_CHOICE_ROW_HOVER = "cursor-pointer [&_input]:sala-hover:border-sala-ink";

/** El `<input>`, que es el dibujo: ocupa su caja entera y lleva el foco. */
export const SALA_CHOICE_BOX = [
  "peer absolute inset-0 m-0 h-full w-full appearance-none rounded-none border-2 bg-transparent",
  "transition-colors duration-sala-fast ease-sala motion-reduce:transition-none",
  "sala-focused:sala-focus",
  "forced-colors:appearance-auto",
];

export const SALA_CHOICE_TEXT = "min-w-0 [overflow-wrap:anywhere]";

/** Lo que va debajo de la fila (ayuda y error) empieza donde el texto: 24 px del dibujo y 12 de hueco. */
export const SALA_CHOICE_BELOW = "pl-9";

/**
 * `data-sala-force` (solo Storybook) llega al `<input>` con el resto de props;
 * la fila lo necesita también, porque el hover es suyo.
 */
export function salaForce(props: object): string | undefined {
  return (props as { "data-sala-force"?: string })["data-sala-force"];
}

export const SalaCheckbox = React.forwardRef<HTMLInputElement, SalaCheckboxProps>(function SalaCheckbox(
  { label, requirement, hint, error, id, className, fieldClassName, required, disabled, "aria-describedby": describedBy, ...props },
  ref
) {
  const { control, ids, invalid, anuncio } = useSalaField({ id, hint, error, describedBy });

  return (
    <div className={cn("grid min-w-0", fieldClassName)}>
      <label
        data-sala-force={salaForce(props)}
        className={cn(
          SALA_CHOICE_ROW,
          disabled ? "cursor-not-allowed text-sala-ink-disabled" : "text-sala-ink",
          !disabled && !invalid && SALA_CHOICE_ROW_HOVER,
          !disabled && invalid && "cursor-pointer"
        )}
      >
        <span className="relative mt-px inline-flex h-6 w-6 shrink-0">
          <input
            ref={ref}
            {...control}
            type="checkbox"
            required={required}
            disabled={disabled}
            className={cn(
              SALA_CHOICE_BOX,
              disabled
                ? "cursor-not-allowed border-dashed border-sala-border"
                : cn("cursor-pointer checked:border-sala-ink checked:bg-sala-ink", invalid ? "border-sala-danger" : "border-sala-border"),
              className
            )}
            {...props}
          />
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="square"
            className={cn(
              "pointer-events-none absolute inset-0 hidden h-full w-full peer-checked:block forced-colors:!hidden",
              disabled ? "text-sala-ink-disabled" : "text-sala-background"
            )}
          >
            <path d="M5.5 10.5 8.5 13.5 14.5 6.5" />
          </svg>
        </span>
        <span className={SALA_CHOICE_TEXT}>
          {label}
          {requirement ? (
            <span aria-hidden={required || undefined} className={cn("sala-type-small", !disabled && "text-sala-ink-secondary")}>
              {" "}
              {requirement}
            </span>
          ) : null}
        </span>
      </label>
      {hint ? (
        <SalaFieldHint id={ids.hint} className={SALA_CHOICE_BELOW}>
          {hint}
        </SalaFieldHint>
      ) : null}
      {error ? (
        <SalaFieldError id={ids.error} className={cn(SALA_CHOICE_BELOW, hint && "mt-2")}>
          {error}
        </SalaFieldError>
      ) : null}
      <SalaFieldAnnouncer>{anuncio}</SalaFieldAnnouncer>
    </div>
  );
});
