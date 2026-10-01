import * as React from "react";
import { cn } from "@/lib/utils/index";

export interface KInputProps extends React.ComponentProps<"input"> {
  label?: string;
  error?: string;
  hint?: string;
}

/**
 * Campo de formulario con el acabado F0 (canvas "Kultura — Diseño completo",
 * artboard Login). Valores literales del mockup, no aproximados:
 *
 * - Etiqueta encima, 13px peso 700 en `--muted` (= `text-tertiary`). Antes era
 *   14px peso 500 en `text-secondary`.
 * - Caja rellena de `--surface-2` SIN borde, radio 14px, padding 15/18, 15px.
 *   Antes era una píldora (999px) con borde sobre `surface-base`: el radio de
 *   píldora es de botones y chips, no de campos — en F0 ningún input lo lleva.
 * - El foco va con el anillo pink del canvas (`0 0 0 6px pink/0.25`), que es la
 *   única sombra de foco que existe en las 17 pantallas; el verde de antes no
 *   salía de ningún sitio.
 *
 * El estado de error mantiene el rojo semántico: el canvas no dibuja ningún
 * campo con error, así que se conserva el patrón que ya había en vez de
 * inventar uno.
 */
export const KInput = React.forwardRef<HTMLInputElement, KInputProps>(
  ({ className, type, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex w-full flex-col gap-2">
        {label && (
          <label
            htmlFor={inputId}
            className="font-body text-[13px] font-bold text-text-tertiary"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          type={type}
          className={cn(
            "w-full rounded-[14px] bg-surface-elevated px-[18px] py-[15px]",
            "font-body text-[15px] text-text-primary",
            "placeholder:text-text-tertiary",
            "transition-shadow duration-base ease-standard",
            "focus-visible:outline-none focus-visible:shadow-[0_0_0_6px_oklch(68%_0.24_350_/_0.25)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "shadow-[0_0_0_2px_var(--accent-danger)]",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="font-body text-xs text-accent-danger">{error}</p>
        )}
        {hint && !error && (
          <p className="font-body text-xs text-text-tertiary">{hint}</p>
        )}
      </div>
    );
  }
);
KInput.displayName = "KInput";
