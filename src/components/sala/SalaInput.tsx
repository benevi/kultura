"use client";

import * as React from "react";
import { cn } from "@/lib/utils/index";
import { SalaButton } from "./SalaButton";
import { SALA_CONTROL, SALA_CONTROL_STATE, SalaField, salaControlState, useSalaLength, type SalaFieldTexts } from "./SalaField";

/**
 * Campo de texto de «Sala» (fase 8.4). Convive con `KInput`, que sigue siendo
 * el de las pantallas de hoy.
 *
 * Es un `<input>` nativo dentro de `SalaField`: etiqueta, ayuda, error y
 * contador ya van asociados. `ref`, `className` y el resto de props llegan al
 * `<input>`; `fieldClassName`, a la caja del campo entero.
 *
 * - `type`: `text`, `email`, `password`, `search`, `number`, `tel`, `url` y
 *   `date`. Con `email`, `password` y `url` no se corrige ni se pone mayúscula
 *   inicial. `autoComplete` e `inputMode` se pasan tal cual: quien conoce el
 *   dato (`email`, `current-password`, `one-time-code`…) es la pantalla
 *   (WCAG 1.3.5).
 * - **Contraseña:** con `revealLabel` («Mostrar contraseña») aparece un botón
 *   de 48 px que la enseña. Su nombre no cambia; lo que cambia es
 *   `aria-pressed` y el dibujo (ojo tachado, ojo abierto).
 * - **Contador:** con `maxLength` y `counter`, que da el texto («12 de 60»).
 * - `leading`: un icono de adorno delante (la lupa de una búsqueda).
 *   `trailing`: un control detrás (un `SalaButton` de solo icono que borra).
 */
export type SalaInputType = "text" | "email" | "password" | "search" | "number" | "tel" | "url" | "date";

export interface SalaInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "children">, SalaFieldTexts {
  type?: SalaInputType;
  /** Solo con `type="password"`: nombre del botón que la enseña, ya traducido. */
  revealLabel?: string;
  /** Con `maxLength`: el texto del contador a partir de lo escrito y el tope. */
  counter?: (length: number, max: number) => string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  fieldClassName?: string;
}

/** En estos, el corrector y la mayúscula inicial estorban (y la contraseña no debe salir hacia un corrector). */
const SIN_CORRECTOR: ReadonlySet<SalaInputType> = new Set(["email", "password", "url"]);

/** Un SVG no cambia de color solo con colores forzados: se le da el del texto de un botón. */
const trazo = {
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "square",
  className: "forced-colors:text-[color:ButtonText]",
} as const;

/** Ojo tachado: la contraseña está oculta. */
const OjoTachado = () => (
  <svg {...trazo}>
    <path d="M2 10l8-5 8 5-8 5zM3 17 17 3" />
  </svg>
);

/** Ojo abierto: la contraseña se ve. */
const OjoAbierto = () => (
  <svg {...trazo}>
    <path d="M2 10l8-5 8 5-8 5zM9 9h2v2H9z" />
  </svg>
);

export const SalaInput = React.forwardRef<HTMLInputElement, SalaInputProps>(function SalaInput(
  {
    label,
    requirement,
    hint,
    error,
    id,
    type = "text",
    revealLabel,
    counter,
    leading,
    trailing,
    className,
    fieldClassName,
    required,
    disabled,
    readOnly,
    maxLength,
    value,
    defaultValue,
    onChange,
    autoCapitalize,
    spellCheck,
    "aria-describedby": describedBy,
    ...props
  },
  ref
) {
  const [visible, setVisible] = React.useState(false);
  const { length: largo, setOwn: setPropio, watch } = useSalaLength(value, defaultValue, ref);

  const conBoton = type === "password" && revealLabel !== undefined;
  const count = counter && maxLength !== undefined ? { text: counter(largo, maxLength), full: largo >= maxLength } : undefined;
  const sinCorrector = SIN_CORRECTOR.has(type);

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
        <div className="relative min-w-0">
          {leading ? (
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute left-3 top-0 flex h-sala-target items-center [&>svg]:h-5 [&>svg]:w-5 forced-colors:[&>svg]:text-[color:FieldText]",
                disabled ? "text-sala-ink-disabled" : "text-sala-ink-secondary"
              )}
            >
              {leading}
            </span>
          ) : null}
          <input
            ref={watch}
            {...control}
            type={type === "password" && visible ? "text" : type}
            required={required}
            disabled={disabled}
            readOnly={readOnly}
            maxLength={maxLength}
            value={value}
            defaultValue={defaultValue}
            autoCapitalize={autoCapitalize ?? (sinCorrector ? "none" : undefined)}
            spellCheck={spellCheck ?? (sinCorrector ? false : undefined)}
            onChange={(event) => {
              setPropio(event.target.value.length);
              onChange?.(event);
            }}
            className={cn(
              SALA_CONTROL,
              // El aspa propia de las búsquedas de WebKit: quien quiera borrar pone su botón en `trailing`.
              "[&::-webkit-search-cancel-button]:appearance-none",
              SALA_CONTROL_STATE[salaControlState({ disabled, readOnly, invalid: control["aria-invalid"] })],
              leading && "pl-11",
              (conBoton || trailing) && "pr-14",
              className
            )}
            {...props}
          />
          {conBoton ? (
            <span className="absolute right-0 top-0 flex">
              <SalaButton
                variant="quiet"
                icon={visible ? <OjoAbierto /> : <OjoTachado />}
                label={revealLabel}
                aria-pressed={visible}
                aria-controls={control.id}
                disabled={disabled}
                onClick={() => setVisible((v) => !v)}
              />
            </span>
          ) : trailing ? (
            <span className="absolute right-0 top-0 flex">{trailing}</span>
          ) : null}
        </div>
      )}
    </SalaField>
  );
});
