"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
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
 * su contenido encoge un punto (la caja no: un clic en el borde sigue siendo un
 * clic). Deshabilitado: borde discontinuo y gris, igual en todas. Una palabra
 * más larga que el botón se parte antes que salirse.
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

/**
 * Solo icono: `label` es su nombre accesible, ya traducido. No lleva `title`:
 * repetiría el nombre en el lector de pantalla y no llega al teclado ni al
 * táctil. Si hace falta el rótulo a la vista, es un botón con texto.
 */
interface SoloIcono {
  icon: React.ReactNode;
  iconPosition?: undefined;
  label: string;
}

/**
 * Un `<button>`: puede cargar. Cargando no se puede volver a pulsar, conserva
 * el foco, el ancho y su texto, y se anuncia. Quien pasa `loading` lo pasa
 * siempre (`loading={enviando}`), también en `false`: la región que lo anuncia
 * tiene que existir antes de que empiece la carga. `loadingLabel` es lo que oye
 * el lector de pantalla, ya traducido (`common.loading`, o algo más preciso).
 *
 * A la vista, la espera son tres cuadrados bajo el texto que se encienden por
 * turnos: siempre hay uno encendido del todo, y a los 4,4 s se quedan los tres
 * encendidos y quietos (biblia §6: nada se mueve solo más de 5 s). Con
 * movimiento reducido están así desde el principio. El texto no se oculta ni
 * se atenúa nunca.
 *
 * **El final de la carga no lo anuncia el botón.** Al acabar, la región se
 * vacía y nada más: el botón no sabe si salió bien o mal, y un «hecho» fijo
 * mentiría en el error y repetiría el aviso de quien sí lo sabe. Quien usa
 * `loading` anuncia el resultado: un aviso con `role="status"` (o `alert` si
 * falló), el mensaje de error junto al campo, o el cambio de pantalla.
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
  "relative inline-flex min-h-sala-target max-w-full items-center justify-center",
  "border-2 px-6 py-2 text-center sala-type-label",
  "touch-manipulation select-none [-webkit-tap-highlight-color:transparent]",
  "transition-colors duration-sala-fast ease-sala motion-reduce:transition-none",
  "sala-focused:sala-focus",
];

/** Lo de dentro (icono y texto): es lo que encoge al pulsar, no la caja. */
const CONTENIDO =
  "inline-flex min-w-0 items-center justify-center gap-2 transition-transform duration-sala-fast ease-sala motion-reduce:transition-none";

/** Una palabra sin cortes (una URL, un título pegado) se parte: el botón no desborda. */
const TEXTO = "min-w-0 [overflow-wrap:anywhere]";

const REPOSO: Record<SalaButtonVariant, string> = {
  primary: "border-transparent bg-sala-accent text-sala-accent-ink",
  secondary: "border-sala-ink bg-transparent text-sala-ink",
  quiet: "border-transparent bg-transparent text-sala-ink",
  danger: "border-transparent bg-sala-danger text-sala-danger-ink",
};

/**
 * Una sola regla para todas: tinta al pasar el puntero y, al pulsar, tinta y el
 * contenido un punto más pequeño. El pulsado no puede ser otro gris (el
 * `ink-secondary` de los enlaces): en los neutros el acento ya es uno casi
 * igual, y en táctil, sin hover, el botón principal no cambiaría. Encoge el
 * contenido y no la caja: si la caja encoge, el puntero que pulsó en el borde
 * queda fuera al soltar y el clic se pierde.
 */
const INTERACCION = [
  "cursor-pointer",
  "sala-hover:border-sala-ink sala-hover:bg-sala-ink sala-hover:text-sala-background",
  "sala-pressed:border-sala-ink sala-pressed:bg-sala-ink sala-pressed:text-sala-background",
  "[&>span:first-child]:sala-pressed:scale-[0.96]",
];

/** El gris es el del borde (3:1); el trazo discontinuo lo dice sin color. */
const DESHABILITADO = "cursor-not-allowed border-dashed border-sala-border bg-transparent text-sala-ink-disabled";

// Con colores forzados el icono (trazo `currentColor`) hereda el color que el
// sistema le pone al botón: el de texto, el gris si está deshabilitado, el de
// enlace si es un enlace. No se le fuerza otro: parecería activo sin estarlo.
const ICONO = "inline-flex shrink-0 [&>svg]:h-5 [&>svg]:w-5";

/**
 * Un cuadrado de la espera. Con colores forzados el fondo de un elemento se
 * sustituye por el del sistema y `bg-current` desaparecería: ahí lleva un color
 * del sistema, que sí se respeta.
 */
const CUADRADO = "h-1 w-1 animate-sala-wait bg-current motion-reduce:animate-none forced-colors:bg-[ButtonText]";

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

  const contenido = (texto: React.ReactNode) => (
    <span className={CONTENIDO}>
      {iconPosition === "start" ? adorno : null}
      {texto === undefined || texto === null ? null : <span className={TEXTO}>{texto}</span>}
      {iconPosition === "end" ? adorno : null}
    </span>
  );

  if (asChild) {
    // El hijo único es el elemento que se pinta; su contenido pasa dentro del
    // mismo envoltorio que en el botón, para que pulse y parta igual.
    const hijo = children as React.ReactElement<{ children?: React.ReactNode }>;
    return (
      <Slot ref={ref} className={classes} aria-label={label} aria-disabled={disabled || undefined} onClick={handleClick} {...props}>
        {React.cloneElement(hijo, undefined, contenido(hijo.props.children))}
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
        className={classes}
        onClick={handleClick}
        {...props}
      >
        {contenido(children)}
        {/* Bajo el contenido, que no se mueve ni se oculta: ni el ancho ni el alto cambian. */}
        {cargando ? (
          <span data-sala-loader="" aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[3px] flex justify-center gap-1">
            <span className={CUADRADO} />
            <span className={cn(CUADRADO, "[animation-delay:400ms]")} />
            <span className={cn(CUADRADO, "[animation-delay:800ms]")} />
          </span>
        ) : null}
      </button>
      {/* Lo que oye el lector de pantalla. Va fuera del botón: dentro no se anuncia.
          Al acabar se vacía; el resultado lo anuncia quien usa el botón. */}
      {loading === undefined ? null : (
        <span role="status" className="sr-only">
          {cargando ? loadingLabel : null}
        </span>
      )}
    </>
  );
});
