"use client";

import * as React from "react";
import { cn } from "@/lib/utils/index";
import { SALA_CONTROL, SALA_CONTROL_STATE, SalaField, salaControlState, useSalaLength, type SalaFieldTexts } from "./SalaField";

/**
 * Área de texto de «Sala» (fase 8.4): reseñas, notas, descripciones.
 *
 * Un `<textarea>` nativo dentro de `SalaField`, con las mismas reglas que
 * `SalaInput`. Crece hacia abajo si la persona tira de la esquina; nunca a lo
 * ancho. Con `maxLength` y `counter` lleva contador.
 */
export interface SalaTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "children">, SalaFieldTexts {
  /** Con `maxLength`: el texto del contador a partir de lo escrito y el tope. */
  counter?: (length: number, max: number) => string;
  fieldClassName?: string;
}

export const SalaTextarea = React.forwardRef<HTMLTextAreaElement, SalaTextareaProps>(function SalaTextarea(
  {
    label,
    requirement,
    hint,
    error,
    id,
    counter,
    className,
    fieldClassName,
    required,
    disabled,
    readOnly,
    maxLength,
    rows = 4,
    value,
    defaultValue,
    onChange,
    "aria-describedby": describedBy,
    ...props
  },
  ref
) {
  const { length: largo, setOwn: setPropio, watch } = useSalaLength(value, defaultValue, ref);
  const count = counter && maxLength !== undefined ? { text: counter(largo, maxLength), full: largo >= maxLength } : undefined;

  return (
    <SalaField
      id={id}
      label={label}
      requirement={requirement}
      hint={hint}
      error={error}
      required={required}
      describedBy={describedBy}
      count={count}
      className={fieldClassName}
    >
      {(control) => (
        <textarea
          ref={watch}
          {...control}
          rows={rows}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          maxLength={maxLength}
          value={value}
          defaultValue={defaultValue}
          onChange={(event) => {
            setPropio(event.target.value.length);
            onChange?.(event);
          }}
          className={cn(
            SALA_CONTROL,
            "resize-y py-3",
            SALA_CONTROL_STATE[salaControlState({ disabled, readOnly, invalid: control["aria-invalid"] })],
            (disabled || readOnly) && "resize-none",
            className
          )}
          {...props}
        />
      )}
    </SalaField>
  );
});
