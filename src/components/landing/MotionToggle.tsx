"use client";

// ============================================================
// KULTURA — Pausar la animación de fondo de la landing (ACC-6, WCAG 2.2.2)
//
// La galería de portadas se mueve sola más de 5 s, así que tiene que poder
// pararse. El botón va el PRIMERO en el DOM de la página (antes de la
// cabecera) para llegar con un Tab, y se ve fijo en la esquina inferior
// derecha: caja de 44×44 con radio 16 sobre `--surface-elevated`, la misma de
// la búsqueda de la cabecera (DISENO.md). Solo existe mientras hay animación.
// ============================================================

import * as React from "react";
import { heroMotion, serverMotionState } from "@/lib/landing/motion";

export function MotionToggle({ pauseLabel, region }: { pauseLabel: string; region: string }) {
  const state = React.useSyncExternalStore(heroMotion.subscribe, heroMotion.get, serverMotionState);
  if (state === "off") return null;
  const paused = state === "paused";

  return (
    <aside aria-label={region} className="fixed bottom-5 right-5 z-40 motion-reduce:hidden">
      <button
        type="button"
        aria-pressed={paused}
        aria-label={pauseLabel}
        title={pauseLabel}
        onClick={() => heroMotion.toggle()}
        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-surface-border bg-surface-elevated text-text-primary transition-colors hover:bg-surface-border focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        {paused ? (
          // Reanudar: triángulo de reproducción.
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-5 w-5">
            <path d="M8 5.5v13a1 1 0 0 0 1.52.85l10.4-6.5a1 1 0 0 0 0-1.7L9.52 4.65A1 1 0 0 0 8 5.5Z" />
          </svg>
        ) : (
          // Pausa: dos barras redondeadas (iconos rellenos, como el resto).
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-5 w-5">
            <rect x="5.5" y="4.5" width="4.5" height="15" rx="1.5" />
            <rect x="14" y="4.5" width="4.5" height="15" rx="1.5" />
          </svg>
        )}
      </button>
    </aside>
  );
}
