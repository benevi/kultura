// ============================================================
// KULTURA — Estado de la animación de fondo de la landing (ACC-6)
//
// El botón de pausa va ANTES de la cabecera en el DOM (llega con ≤ 3 Tab)
// y el hero va dentro de <main>: son dos componentes de cliente separados, así
// que comparten el estado por aquí, sin contexto ni props.
//
//   - "off":     no hay animación (móvil, reducir movimiento, sin WebGL…):
//                el botón no se pinta.
//   - "running": la galería se mueve.
//   - "paused":  la persona la ha parado; se queda parada hasta que la reanude.
// ============================================================

export type MotionState = "off" | "running" | "paused";

let state: MotionState = "off";
const listeners = new Set<() => void>();

export const heroMotion = {
  get(): MotionState {
    return state;
  },
  set(next: MotionState): void {
    if (next === state) return;
    state = next;
    listeners.forEach((fn) => fn());
  },
  /** Alterna pausa/reanudar; sin animación no hace nada. */
  toggle(): void {
    if (state === "running") heroMotion.set("paused");
    else if (state === "paused") heroMotion.set("running");
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

/** Para `useSyncExternalStore` en el servidor: nunca hay animación. */
export const serverMotionState = (): MotionState => "off";
