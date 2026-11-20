import * as React from "react";
import { cn } from "@/lib/utils/index";
import { K_FIELD_BOX, K_FIELD_ERROR, KFieldFrame, useKField } from "./KField";

export interface KTextareaProps extends React.ComponentProps<"textarea"> {
  label?: string;
  error?: string;
  hint?: string;
}

/**
 * Área de texto con la caja de `KInput` (C14): misma etiqueta, mismo borde,
 * mismo foco y el mismo error o ayuda debajo, con `aria-invalid` y
 * `aria-describedby`. Crece hacia abajo si se tira de la esquina, nunca a lo
 * ancho. El alto lo dan `rows` y, si hace falta, un `min-h-…` en `className`.
 *
 * Un contador u otra nota propia de la pantalla se pinta fuera y se enlaza con
 * `aria-describedby`, que se conserva delante del mensaje del campo.
 */
export const KTextarea = React.forwardRef<HTMLTextAreaElement, KTextareaProps>(
  ({ className, label, error, hint, id, "aria-describedby": describedByProp, ...props }, ref) => {
    const { controlId, messageId, ...aria } = useKField({
      id,
      prefix: "ktextarea",
      error,
      hint,
      describedBy: describedByProp,
    });

    return (
      <KFieldFrame controlId={controlId} messageId={messageId} label={label} error={error} hint={hint}>
        <textarea
          id={controlId}
          {...aria}
          className={cn(K_FIELD_BOX, "resize-y", error && K_FIELD_ERROR, className)}
          ref={ref}
          {...props}
        />
      </KFieldFrame>
    );
  }
);
KTextarea.displayName = "KTextarea";
