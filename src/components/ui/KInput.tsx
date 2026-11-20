import * as React from "react";
import { cn } from "@/lib/utils/index";
import { K_FIELD_BOX, K_FIELD_ERROR, KFieldFrame, useKField } from "./KField";

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
 * Excepciones al canvas por accesibilidad (documentadas en el sistema de diseño):
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
 *
 * La caja, la etiqueta y el mensaje son los de `KField`: `KTextarea` y
 * `Select` los comparten.
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
    const { controlId, messageId, ...aria } = useKField({
      id,
      prefix: "kinput",
      error,
      hint,
      describedBy: describedByProp,
    });
    const isEmail = type === "email";

    return (
      <KFieldFrame controlId={controlId} messageId={messageId} label={label} error={error} hint={hint}>
        <input
          id={controlId}
          type={type}
          {...aria}
          autoCapitalize={autoCapitalize ?? (isEmail ? "none" : undefined)}
          spellCheck={spellCheck ?? (isEmail ? false : undefined)}
          className={cn(K_FIELD_BOX, error && K_FIELD_ERROR, className)}
          ref={ref}
          {...props}
        />
      </KFieldFrame>
    );
  }
);
KInput.displayName = "KInput";
