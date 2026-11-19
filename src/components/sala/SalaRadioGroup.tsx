"use client";

import * as React from "react";
import { cn } from "@/lib/utils/index";
import { SALA_CHOICE_BELOW, SALA_CHOICE_BOX, SALA_CHOICE_ROW, SALA_CHOICE_ROW_DISABLED, SALA_CHOICE_ROW_HOVER, SALA_CHOICE_TEXT, salaForce } from "./SalaCheckbox";
import { SalaFieldAnnouncer, SalaFieldError, SalaFieldHint, useSalaField } from "./SalaField";

/**
 * Grupo de radios de «Sala» (fase 8.4): elegir una entre pocas opciones que
 * conviene ver todas (la visibilidad de una lista, el estado de una obra).
 * Con muchas, `SalaSelect`.
 *
 * Un `<fieldset>` con su `<legend>` y un `<input type="radio">` nativo por
 * opción: las flechas cambian de opción y Tab entra y sale del grupo, como
 * hace el navegador. El grupo lleva la pregunta, la ayuda y el error; cada
 * opción, su texto y, si hace falta, una línea de ayuda propia.
 *
 * ```tsx
 * <SalaRadioGroup legend="Quién puede verla" name="visibility" defaultValue="private">
 *   <SalaRadio value="private" label="Solo yo" />
 *   <SalaRadio value="public" label="Cualquiera" hint="Aparece en tu perfil" />
 * </SalaRadioGroup>
 * ```
 *
 * El radio es redondo: es la única curva del sistema, y es la que lo distingue
 * de una casilla sin leer nada.
 *
 * - **El error** lo lleva cada radio en su descripción, no el grupo: al llevar
 *   el foco a un radio, no todos los lectores leen la descripción del grupo
 *   (VoiceOver), y puesto en los dos sitios se oiría dos veces. El grupo lleva
 *   `aria-invalid` y la ayuda.
 * - **Obligatorio** lo dice el grupo (`aria-required`). Cada radio lleva
 *   además `required` para el formulario, pero el navegador no lo pasa al
 *   árbol de accesibilidad de cada radio (medido en Chromium): se oye una vez.
 */
export interface SalaRadioGroupProps extends Omit<React.FieldsetHTMLAttributes<HTMLFieldSetElement>, "onChange" | "defaultValue"> {
  /** La pregunta del grupo, siempre a la vista. */
  legend: React.ReactNode;
  /** `name` de los radios: los une en un grupo y es la clave al enviar. */
  name: string;
  /** Opción elegida, si lo lleva quien lo usa. Sin `value`, lo lleva el navegador. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  /** «obligatorio» u «opcional», ya traducido. */
  requirement?: string;
  hint?: React.ReactNode;
  error?: string;
}

interface Grupo {
  name: string;
  value: string | undefined;
  defaultValue: string | undefined;
  onChange: ((value: string) => void) | undefined;
  required: boolean | undefined;
  disabled: boolean | undefined;
  invalid: boolean;
  /** Id del error del grupo, si lo hay: entra en la descripción de cada radio. */
  errorId: string | undefined;
}

const GrupoContexto = React.createContext<Grupo | null>(null);

export const SalaRadioGroup = React.forwardRef<HTMLFieldSetElement, SalaRadioGroupProps>(function SalaRadioGroup(
  { legend, name, value, defaultValue, onChange, required, requirement, hint, error, id, disabled, className, children, "aria-describedby": describedBy, ...props },
  ref
) {
  const { control, ids, invalid, anuncio } = useSalaField({ id, hint, error, describedBy });
  const errorId = invalid ? ids.error : undefined;
  const grupo = React.useMemo<Grupo>(
    () => ({ name, value, defaultValue, onChange, required, disabled, invalid, errorId }),
    [name, value, defaultValue, onChange, required, disabled, invalid, errorId]
  );
  // El error no describe al grupo: lo lleva cada radio (una sola vez por el camino del foco).
  const descripcion =
    control["aria-describedby"]
      ?.split(" ")
      .filter((parte) => parte !== ids.error)
      .join(" ") || undefined;

  return (
    <fieldset
      ref={ref}
      {...control}
      aria-describedby={descripcion}
      // Un `fieldset` es un grupo cualquiera; `radiogroup` es el que admite
      // «obligatorio» y «no válido». Su nombre es la `legend`.
      role="radiogroup"
      aria-labelledby={ids.label}
      aria-required={required || undefined}
      disabled={disabled}
      className={cn("m-0 grid min-w-0 border-0 p-0", className)}
      {...props}
    >
      <legend id={ids.label} className="mb-1 min-w-0 p-0 text-sala-ink sala-type-label [overflow-wrap:anywhere]">
        {legend}
        {requirement ? (
          <span aria-hidden={required || undefined} className="font-medium text-sala-ink-secondary sala-type-small">
            {" "}
            {requirement}
          </span>
        ) : null}
      </legend>
      {hint ? <SalaFieldHint id={ids.hint}>{hint}</SalaFieldHint> : null}
      <GrupoContexto.Provider value={grupo}>{children}</GrupoContexto.Provider>
      {error ? (
        <SalaFieldError id={ids.error} className="mt-1">
          {error}
        </SalaFieldError>
      ) : null}
      <SalaFieldAnnouncer>{anuncio}</SalaFieldAnnouncer>
    </fieldset>
  );
});

export interface SalaRadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "name" | "value" | "checked" | "defaultChecked" | "children"> {
  value: string;
  /** El texto de la opción, siempre a la vista. */
  label: React.ReactNode;
  /** Una línea de ayuda de esta opción. */
  hint?: React.ReactNode;
}

export const SalaRadio = React.forwardRef<HTMLInputElement, SalaRadioProps>(function SalaRadio(
  { value, label, hint, id, disabled: propio, className, onChange, "aria-describedby": describedBy, ...props },
  ref
) {
  const grupo = React.useContext(GrupoContexto);
  if (!grupo) throw new Error("SalaRadio va dentro de un SalaRadioGroup");
  const auto = React.useId();
  const radioId = id ?? `sala-${auto}`;
  const hintId = `${radioId}-hint`;
  const disabled = propio || grupo.disabled;
  const elegido = grupo.value === undefined ? { defaultChecked: grupo.defaultValue === value } : { checked: grupo.value === value };

  return (
    <div className="grid min-w-0">
      <label
        data-sala-force={salaForce(props)}
        className={cn(
          SALA_CHOICE_ROW,
          disabled ? SALA_CHOICE_ROW_DISABLED : "text-sala-ink",
          !disabled && !grupo.invalid && SALA_CHOICE_ROW_HOVER,
          !disabled && grupo.invalid && "cursor-pointer"
        )}
      >
        <span className="relative mt-px inline-flex h-6 w-6 shrink-0">
          <input
            ref={ref}
            id={radioId}
            type="radio"
            name={grupo.name}
            value={value}
            {...elegido}
            required={grupo.required}
            disabled={disabled}
            aria-describedby={[describedBy, grupo.errorId, hint ? hintId : undefined].filter(Boolean).join(" ") || undefined}
            onChange={(event) => {
              onChange?.(event);
              if (event.target.checked) grupo.onChange?.(value);
            }}
            className={cn(
              SALA_CHOICE_BOX,
              "rounded-full",
              disabled
                ? "cursor-not-allowed border-dashed border-sala-border"
                : cn("cursor-pointer checked:border-sala-ink", grupo.invalid ? "border-sala-danger" : "border-sala-border"),
              className
            )}
            {...props}
          />
          {/* La marca: un punto de tinta. */}
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-[6px] hidden rounded-full peer-checked:block forced-colors:!hidden",
              disabled ? "bg-sala-ink-disabled" : "bg-sala-ink"
            )}
          />
        </span>
        <span className={SALA_CHOICE_TEXT}>{label}</span>
      </label>
      {hint ? (
        <SalaFieldHint id={hintId} className={cn(SALA_CHOICE_BELOW, "-mt-2 mb-2")}>
          {hint}
        </SalaFieldHint>
      ) : null}
    </div>
  );
});
