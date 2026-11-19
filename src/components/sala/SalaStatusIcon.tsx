import * as React from "react";
import { cn } from "@/lib/utils/index";

/**
 * Los dibujos de los avisos de «Sala» (fase 8.4): uno por tono, de trazo recto
 * y con **forma distinta** cada uno, para que el tono no dependa del color
 * (WCAG 1.4.1): una «i» en un cuadrado, una marca de hecho, un triángulo y un
 * aspa en un cuadrado. Son adorno (`aria-hidden`): lo que pasa lo dice el
 * texto que acompañan.
 *
 * Trazo `currentColor`: el color lo pone quien los usa. Con colores forzados
 * un SVG no cambia solo, así que toman el color de texto del sistema.
 */
export type SalaTone = "info" | "success" | "warning" | "error";

const DIBUJO: Record<SalaTone, string> = {
  info: "M3 3h14v14H3zM10 10v4M10 6v.5",
  success: "M3 10.5 8 15.5 17 5",
  warning: "M10 2.5 18.5 17.5h-17zM10 8v3.5M10 14.5v.01",
  error: "M3 3h14v14H3zM7 7l6 6M13 7l-6 6",
};

const TRAZO = {
  "aria-hidden": true,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "square",
} as const;

export function SalaStatusIcon({ tone, className }: { tone: SalaTone; className?: string }) {
  return (
    <svg {...TRAZO} data-sala-tone-icon={tone} className={cn("h-5 w-5 shrink-0 forced-colors:text-[color:CanvasText]", className)}>
      <path d={DIBUJO[tone]} />
    </svg>
  );
}

/** El aspa de cerrar: la misma en el diálogo, el aviso y el aviso efímero. */
export function SalaCloseIcon({ className }: { className?: string }) {
  return (
    <svg {...TRAZO} className={className}>
      <path d="M4 4l12 12M16 4 4 16" />
    </svg>
  );
}
