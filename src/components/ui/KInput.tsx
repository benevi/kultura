import * as React from "react";
import { cn } from "@/lib/utils/index";

export interface KInputProps extends React.ComponentProps<"input"> {
  label?: string;
  error?: string;
  hint?: string;
}

/**
 * Campo de formulario con el acabado F0 (canvas "Kultura — Diseño completo",
 * artboard Login):
 *
 * - Etiqueta encima, 13px peso 700 en `--muted` (= `text-tertiary`).
 * - Caja rellena de `--surface-2`, radio 14px, padding 15/18.
 *
 * Excepciones al canvas por accesibilidad (documentadas en DISENO.md):
 * - Borde de 1 px `--field-border` (ACC-4, WCAG 1.4.11). Sin él, el relleno
 *   `surface-2` sobre la tarjeta `surface` daba 1,14:1 y el campo no se veía;
 *   en alto contraste de Windows desaparecía del todo.
 * - Foco = contorno pink de 2 px con separación (5,45:1), no el halo
 *   `0 0 0 6px pink/0.25` del canvas (1,39:1). Es `outline` y no `box-shadow`
 *   para que siga visible en `forced-colors`.
 * - 16 px en móvil (MOV-5): con menos, Safari de iOS hace zoom al enfocar.
 *   Desde `md` vuelve a los 15 px del canvas.
 *
 * Errores (ACC-3): el `<p>` del error lleva `role="alert"` y el campo
 * `aria-invalid` + `aria-describedby`, así el lector de pantalla lo anuncia y
 * lo vuelve a leer al llegar al campo. El id se genera con `useId` si no llega
 * uno, para que dos campos con la misma etiqueta no compartan id.
 */
export const KInput = React.forwardRef<HTMLInputElement, KInputProps>(
  (
    {
      className,
      type,
      label,
      error,
      hint,
      id,
      "aria-describedby": describedByProp,
      autoCapitalize,
      spellCheck,
      ...props
    },
    ref
  ) => {
    const autoId = React.useId();
    const inputId = id ?? `kinput-${autoId}`;
    const messageId = `${inputId}-msg`;
    const message = error || hint;
    const describedBy =
      [describedByProp, message ? messageId : undefined].filter(Boolean).join(" ") || undefined;
    const isEmail = type === "email";

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
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          autoCapitalize={autoCapitalize ?? (isEmail ? "none" : undefined)}
          spellCheck={spellCheck ?? (isEmail ? false : undefined)}
          className={cn(
            "w-full rounded-[14px] bg-surface-elevated px-[18px] py-[15px]",
            "border border-field-border",
            "font-body text-base md:text-[15px] text-text-primary",
            "placeholder:text-text-tertiary",
            "transition-colors duration-base ease-standard",
            "focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-accent-danger",
            className
          )}
          ref={ref}
          {...props}
        />
        {error ? (
          <p id={messageId} role="alert" className="font-body text-xs text-accent-danger">
            {error}
          </p>
        ) : hint ? (
          <p id={messageId} className="font-body text-xs text-text-tertiary">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }
);
KInput.displayName = "KInput";
