// ============================================================
// KULTURA — Clases del botón de «Sala» (fase 8.4), sin 'use client'.
// Las usan `SalaButton` (cliente) y las piezas de servidor que pintan un
// enlace con aspecto de botón sin cargar JS (la cabecera pública, M2). Lo que
// exporta un módulo 'use client' llega al servidor como referencia, no como
// texto: por eso viven aquí.
// ============================================================

import { cn } from "@/lib/utils/index";

export type SalaButtonVariant = "primary" | "secondary" | "quiet" | "danger";

export const BASE = [
  "relative inline-flex min-h-sala-target max-w-full items-center justify-center",
  "border-2 px-6 py-2 text-center sala-type-label",
  "touch-manipulation select-none [-webkit-tap-highlight-color:transparent]",
  "transition-colors duration-sala-fast ease-sala motion-reduce:transition-none",
  "sala-focused:sala-focus",
];

/** Lo de dentro (icono y texto): es lo que encoge al pulsar, no la caja. */
export const CONTENIDO =
  "inline-flex min-w-0 items-center justify-center gap-2 transition-transform duration-sala-fast ease-sala motion-reduce:transition-none";

/** Una palabra sin cortes (una URL, un título pegado) se parte: el botón no desborda. */
export const TEXTO = "min-w-0 [overflow-wrap:anywhere]";

export const REPOSO: Record<SalaButtonVariant, string> = {
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
export const INTERACCION = [
  "cursor-pointer",
  "sala-hover:border-sala-ink sala-hover:bg-sala-ink sala-hover:text-sala-background",
  "sala-pressed:border-sala-ink sala-pressed:bg-sala-ink sala-pressed:text-sala-background",
  "[&>span:first-child]:sala-pressed:scale-[0.96]",
];

/** El gris es el del borde (3:1); el trazo discontinuo lo dice sin color. */
export const DESHABILITADO = "cursor-not-allowed border-dashed border-sala-border bg-transparent text-sala-ink-disabled";

/** Un enlace con aspecto de botón, en reposo (sin carga ni deshabilitado). */
export function salaButtonClasses(variant: SalaButtonVariant = "primary", className?: string): string {
  return cn(BASE, REPOSO[variant], INTERACCION, className);
}
