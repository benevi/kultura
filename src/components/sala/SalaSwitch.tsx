"use client";

import * as React from "react";
import { cn } from "@/lib/utils/index";
import { SALA_CHOICE_BOX, SALA_CHOICE_TEXT, salaForce } from "./SalaCheckbox";
import { SalaFieldAnnouncer, SalaFieldError, SalaFieldHint, useSalaField, type SalaFieldTexts } from "./SalaField";

/**
 * Interruptor de «Sala» (fase 8.4): un ajuste que se enciende o se apaga y
 * vale desde ese momento (el correo semanal, los avisos). Si hay que pulsar
 * «Guardar» para que cuente, es una casilla.
 *
 * Un `<input type="checkbox" role="switch">` nativo dentro de su `<label>`: el
 * texto va a la izquierda y el interruptor a la derecha, y la fila entera se
 * pulsa (48 px o más). Encendido o apagado no se dice con color: la pieza
 * cambia de lado y el carril se llena de tinta.
 *
 * `ref`, `className` y el resto de props llegan al `<input>`. Con colores
 * forzados se devuelve la casilla del sistema, que conserva el papel de
 * interruptor.
 */
export interface SalaSwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "role" | "children">, Omit<SalaFieldTexts, "requirement"> {
  fieldClassName?: string;
}

/** Lo de debajo no se mete bajo el interruptor: 48 px del dibujo y 16 de hueco. */
const DEBAJO = "pr-16";

export const SalaSwitch = React.forwardRef<HTMLInputElement, SalaSwitchProps>(function SalaSwitch(
  { label, hint, error, id, className, fieldClassName, disabled, "aria-describedby": describedBy, ...props },
  ref
) {
  const { control, ids, invalid, anuncio } = useSalaField({ id, hint, error, describedBy });

  return (
    <div className={cn("grid min-w-0", fieldClassName)}>
      <label
        data-sala-force={salaForce(props)}
        className={cn(
          "flex min-h-sala-target max-w-full items-center justify-between gap-4 py-2 sala-type-text [-webkit-tap-highlight-color:transparent]",
          disabled ? "cursor-not-allowed text-sala-ink-disabled" : "cursor-pointer text-sala-ink",
          !disabled && !invalid && "[&_input]:sala-hover:border-sala-ink"
        )}
      >
        <span className={SALA_CHOICE_TEXT}>{label}</span>
        <span className="relative inline-flex h-7 w-12 shrink-0">
          <input
            ref={ref}
            {...control}
            type="checkbox"
            role="switch"
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
          {/* La pieza: a la izquierda, apagado; a la derecha, encendido. */}
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute left-1.5 top-1.5 h-4 w-4 peer-checked:translate-x-5 forced-colors:hidden",
              "transition-transform duration-sala-fast ease-sala motion-reduce:transition-none",
              disabled ? "bg-sala-ink-disabled" : "bg-sala-ink peer-checked:bg-sala-background"
            )}
          />
        </span>
      </label>
      {hint ? (
        <SalaFieldHint id={ids.hint} className={DEBAJO}>
          {hint}
        </SalaFieldHint>
      ) : null}
      {error ? (
        <SalaFieldError id={ids.error} className={cn(DEBAJO, hint && "mt-2")}>
          {error}
        </SalaFieldError>
      ) : null}
      <SalaFieldAnnouncer>{anuncio}</SalaFieldAnnouncer>
    </div>
  );
});
