import * as React from "react";

/**
 * La caja de los campos de hoy (C14): `KInput`, `KTextarea` y `Select` la
 * comparten para que, puestos uno junto a otro en el mismo formulario, se vean
 * iguales. El porqué de cada clase está en `KInput`:
 *
 * - Caja `surface-elevated`, radio 16, relleno 15/18.
 * - Borde de 1 px `field-border` (ACC-4, WCAG 1.4.11); rojo con error.
 * - 16 px en móvil (MOV-5: con menos, Safari de iOS amplía la página al
 *   enfocar) y 15 px desde `md`.
 * - Foco con `outline`, no `box-shadow`, para que se vea con colores forzados.
 *
 * En la 8.5 cada pantalla pasa a `SalaInput`/`SalaTextarea`/`SalaSelect`.
 */
export const K_FIELD_BOX = [
  "w-full rounded-2xl bg-surface-elevated px-[18px] py-[15px]",
  "border border-field-border",
  "font-body text-base md:text-body text-text-primary",
  "placeholder:text-text-tertiary",
  "transition-colors duration-base ease-standard",
  "focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
  "disabled:cursor-not-allowed disabled:opacity-50",
] as const;

/** Borde del campo con error (el mensaje va debajo, con texto). */
export const K_FIELD_ERROR = "border-accent-danger";

/** Etiqueta encima del campo: 13 px en negrita, `text-tertiary`. */
export const K_FIELD_LABEL = "font-body text-meta font-bold text-text-tertiary";

interface KFieldOptions {
  id?: string;
  /** Prefijo del id generado (`kinput`, `ktextarea`, `kselect`). */
  prefix: string;
  error?: string;
  hint?: string;
  /** `aria-describedby` que ya traía el control: se conserva, delante. */
  describedBy?: string;
}

/**
 * Ids y asociaciones de un campo (ACC-3): el id se genera con `useId` si no
 * llega uno, y el mensaje (error o ayuda) entra en `aria-describedby`.
 */
export function useKField({ id, prefix, error, hint, describedBy }: KFieldOptions) {
  const autoId = React.useId();
  const controlId = id ?? `${prefix}-${autoId}`;
  const messageId = `${controlId}-msg`;
  const message = error || hint;
  return {
    controlId,
    messageId,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": [describedBy, message ? messageId : undefined].filter(Boolean).join(" ") || undefined,
  };
}

interface KFieldFrameProps {
  controlId: string;
  messageId: string;
  label?: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}

/**
 * Etiqueta encima, el control y, debajo, el error (`role="alert"`, para que se
 * anuncie) o, si no lo hay, la ayuda.
 */
export function KFieldFrame({ controlId, messageId, label, error, hint, children }: KFieldFrameProps) {
  return (
    <div className="flex w-full flex-col gap-2">
      {label && (
        <label htmlFor={controlId} className={K_FIELD_LABEL}>
          {label}
        </label>
      )}
      {children}
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
