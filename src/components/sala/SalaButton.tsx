"use client";

import * as React from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils/index";

/**
 * Botón de «Sala» (fase 8.4). Convive con `KButton`, que sigue siendo el de
 * las pantallas de hoy; este entra con cada pantalla de la 8.5.
 *
 * Biblia §1 y §9: esquinas rectas, color plano, sin sombras y 48 px o más de
 * alto. Pinta con los papeles `--sala-*`, así que vale sobre los neutros y
 * dentro de una obra (`sala-work`), en claro y en oscuro, sin saber dónde está.
 *
 * - `primary`: la acción de la pantalla, sobre el acento.
 * - `secondary`: la que la acompaña, con borde de tinta.
 * - `quiet`: la que no debe competir (cancelar, barras de iconos), sin borde.
 * - `danger`: borrar o salir sin vuelta atrás. El color no lo dice solo: el
 *   texto nombra lo que se pierde.
 *
 * Al pasar el puntero cualquier variante se vuelve tinta; al pulsar, además,
 * encoge un punto. Deshabilitado: borde discontinuo y gris, igual en todas.
 */
export type SalaButtonVariant = "primary" | "secondary" | "quiet" | "danger";

type Nativos = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">;

interface Comunes extends Nativos {
  variant?: SalaButtonVariant;
}

/** Con texto: el icono, si lo hay, es adorno. */
interface ConTexto {
  icon?: React.ReactNode;
  iconPosition?: "start" | "end";
  label?: undefined;
}

/** Solo icono: `label` es su nombre accesible (y su `title`), ya traducido. */
interface SoloIcono {
  icon: React.ReactNode;
  iconPosition?: undefined;
  label: string;
}

/**
 * Un `<button>`: puede cargar. Cargando no se puede volver a pulsar, conserva
 * el foco y el ancho, y se anuncia. Quien pasa `loading` lo pasa siempre
 * (`loading={enviando}`), también en `false`: la región que lo anuncia tiene
 * que existir antes de que empiece la carga. `loadingLabel` es lo que oye el
 * lector de pantalla, ya traducido (`common.loading`, o algo más preciso).
 */
type ComoBoton = { asChild?: false } & (
  | { loading?: undefined; loadingLabel?: undefined }
  | { loading: boolean; loadingLabel: string }
);

/**
 * Con el aspecto del botón pero otro elemento (un enlace): el hijo único es
 * el que se pinta, como en `KButton`. Un enlace no carga.
 */
interface ComoHijo {
  asChild: true;
  loading?: undefined;
  loadingLabel?: undefined;
}

export type SalaButtonProps = Comunes &
  (
    | (ConTexto & ComoBoton & { children: React.ReactNode })
    | (ConTexto & ComoHijo & { children: React.ReactElement })
    | (SoloIcono & ComoBoton & { children?: undefined })
    | (SoloIcono & ComoHijo & { children: React.ReactElement })
  );

const BASE = [
  "relative inline-flex min-h-sala-target max-w-full items-center justify-center gap-2",
  "border-2 px-6 py-2 text-center sala-type-label",
  "touch-manipulation select-none [-webkit-tap-highlight-color:transparent]",
  "transition duration-sala-fast ease-sala motion-reduce:transition-none",
  "sala-focused:sala-focus",
];

const REPOSO: Record<SalaButtonVariant, string> = {
  primary: "border-transparent bg-sala-accent text-sala-accent-ink",
  secondary: "border-sala-ink bg-transparent text-sala-ink",
  quiet: "border-transparent bg-transparent text-sala-ink",
  danger: "border-transparent bg-sala-danger text-sala-danger-ink",
};

/**
 * Una sola regla para todas: tinta al pasar el puntero y, al pulsar, tinta y un
 * punto más pequeño. El pulsado no puede ser otro gris: en los neutros el
 * acento ya es uno, y en táctil (sin hover) no se notaría.
 */
const INTERACCION = [
  "cursor-pointer",
  "sala-hover:border-sala-ink sala-hover:bg-sala-ink sala-hover:text-sala-background",
  "sala-pressed:scale-[0.97] sala-pressed:border-sala-ink sala-pressed:bg-sala-ink sala-pressed:text-sala-background",
];

/** El gris es el del borde (3:1); el trazo discontinuo lo dice sin color. */
const DESHABILITADO = "cursor-not-allowed border-dashed border-sala-border bg-transparent text-sala-ink-disabled";

const ICONO = "inline-flex shrink-0 [&>svg]:h-5 [&>svg]:w-5";

export const SalaButton = React.forwardRef<HTMLButtonElement, SalaButtonProps>(function SalaButton(
  {
    variant = "primary",
    asChild = false,
    loading,
    loadingLabel,
    icon,
    iconPosition = "start",
    label,
    disabled = false,
    type = "button",
    className,
    onClick,
    children,
    ...props
  },
  ref
) {
  const cargando = loading === true;
  const parado = disabled || cargando;

  const classes = cn(
    BASE,
    label !== undefined && "w-sala-target px-0",
    disabled ? DESHABILITADO : REPOSO[variant],
    cargando && "cursor-progress",
    !parado && INTERACCION,
    className
  );

  /** Parado no llega a `onClick` ni envía el formulario ni sigue el enlace. */
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (parado) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  const adorno = icon ? (
    <span aria-hidden="true" className={ICONO}>
      {icon}
    </span>
  ) : null;

  if (asChild) {
    return (
      <Slot
        ref={ref}
        className={classes}
        aria-label={label}
        title={label}
        aria-disabled={disabled || undefined}
        onClick={handleClick}
        {...props}
      >
        {iconPosition === "start" ? adorno : null}
        <Slottable>{children}</Slottable>
        {iconPosition === "end" ? adorno : null}
      </Slot>
    );
  }

  return (
    <>
      <button
        ref={ref}
        type={type}
        // Cargando no lleva `disabled`: perdería el foco de quien lo pulsó.
        disabled={disabled}
        aria-disabled={cargando || undefined}
        aria-busy={cargando || undefined}
        aria-label={label}
        title={label}
        className={classes}
        onClick={handleClick}
        {...props}
      >
        {/* El contenido sigue ocupando su sitio mientras carga: el ancho no cambia. */}
        <span className={cn("inline-flex items-center justify-center gap-2", cargando && "opacity-0")}>
          {iconPosition === "start" ? adorno : null}
          {children === undefined ? null : <span>{children}</span>}
          {iconPosition === "end" ? adorno : null}
        </span>
        {cargando ? (
          <span data-sala-loader="" aria-hidden="true" className="absolute inset-0 flex items-center justify-center gap-1">
            <span className="h-1.5 w-1.5 animate-sala-wait bg-current motion-reduce:animate-none" />
            <span className="h-1.5 w-1.5 animate-sala-wait bg-current [animation-delay:200ms] motion-reduce:animate-none" />
            <span className="h-1.5 w-1.5 animate-sala-wait bg-current [animation-delay:400ms] motion-reduce:animate-none" />
          </span>
        ) : null}
      </button>
      {/* Lo que oye el lector de pantalla. Va fuera del botón: dentro no se anuncia. */}
      {loading === undefined ? null : (
        <span role="status" className="sr-only">
          {cargando ? loadingLabel : null}
        </span>
      )}
    </>
  );
});
