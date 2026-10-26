"use client";

import { forwardRef, useState } from "react";
import { KInput, type KInputProps } from "@/components/ui/KInput";

interface PasswordFieldProps extends Omit<KInputProps, "type"> {
  id: string;
  /** Texto visible del botón ("Mostrar" / "Ocultar"). */
  showText: string;
  hideText: string;
  /** Nombre accesible completo ("Mostrar contraseña" / "Ocultar contraseña"). */
  showLabel: string;
  hideLabel: string;
}

/**
 * Contraseña con "Mostrar/Ocultar" (CRE-5): sustituye al campo "Confirmar
 * contraseña". El botón va en la línea de la etiqueta, a la derecha, con zona
 * táctil de 44px (`py-3 -top-3`) sin mover el diseño del campo.
 */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField({ showText, hideText, showLabel, hideLabel, id, ...props }, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <KInput ref={ref} id={id} type={visible ? "text" : "password"} {...props} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-controls={id}
          aria-label={visible ? hideLabel : showLabel}
          className="absolute -top-3 right-0 px-1 py-3 font-body text-meta font-bold leading-5 text-text-tertiary underline-offset-4 transition-colors duration-base ease-standard hover:text-text-primary hover:underline"
        >
          {visible ? hideText : showText}
        </button>
      </div>
    );
  }
);
