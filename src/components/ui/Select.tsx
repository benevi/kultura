"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils/index";
import { K_FIELD_BOX, K_FIELD_ERROR, KFieldFrame, useKField } from "./KField";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Etiqueta visible asociada con `htmlFor`. Sin ella, pasa `aria-label`. */
  label?: string;
  /** Error debajo, con `role="alert"`; el select queda con `aria-invalid`. */
  error?: string;
  /** Ayuda debajo, enlazada con `aria-describedby`. */
  hint?: string;
  className?: string;
}

/**
 * El `<select>` nativo no aplica `line-height`: con la caja de `KInput` mediría
 * 53 px en móvil y 52 desde `md`, y no 56 y 54 como el campo de al lado
 * (24 o 22 de línea, 15 + 15 de relleno y 1 + 1 de borde). El alto mínimo lo
 * iguala; el texto sigue centrado.
 */
const SELECT_HEIGHT = "min-h-14 md:min-h-[54px]";

/**
 * Desplegable nativo con la caja de `KInput` (C14): la misma etiqueta (13 px
 * en negrita), el mismo fondo, radio, borde (`--field-border`, ACC-4), alto y
 * foco, para que no se vea distinto que los campos que tiene al lado. La
 * etiqueta se asocia con `htmlFor` y la letra es de 16 px en móvil para que
 * iOS no haga zoom al enfocar (MOV-5). El resto de atributos (`aria-*`,
 * `data-*`, `name`…) llega tal cual al `<select>`.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { value, onChange, options, label, error, hint, className, id, "aria-describedby": describedByProp, ...rest },
  ref
) {
  const { controlId, messageId, ...aria } = useKField({
    id,
    prefix: "kselect",
    error,
    hint,
    describedBy: describedByProp,
  });
  return (
    <KFieldFrame controlId={controlId} messageId={messageId} label={label} error={error} hint={hint}>
      <select
        ref={ref}
        id={controlId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...aria}
        className={cn(K_FIELD_BOX, SELECT_HEIGHT, "cursor-pointer", error && K_FIELD_ERROR, className)}
        {...rest}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </KFieldFrame>
  );
});
