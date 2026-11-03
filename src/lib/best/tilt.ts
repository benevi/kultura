// ============================================================
// KULTURA — Inclinación del podio de los rankings (funciones puras)
//
// Los tres brillantes del podio se inclinan hacia el puntero: perspectiva de
// 800 px, como mucho 8°, con muelles amortiguados (rigidez 170, amortiguación
// 26, DISENO.md / contrato de interacción). Lo usan los dos pintores del
// podio: la escena de three.js (escritorio con WebGL) y la inclinación CSS de
// respaldo. Aquí solo hay cuentas, para probarlas sin navegador.
// ============================================================

export const TILT_MAX_DEG = 8;
export const TILT_PERSPECTIVE_PX = 800;
export const SPRING = { stiffness: 170, damping: 26 } as const;

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Tilt {
  /** Giro alrededor del eje X (cabeceo), en grados. */
  rx: number;
  /** Giro alrededor del eje Y (guiñada), en grados. */
  ry: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * Inclinación objetivo de un cromo con el puntero en (`x`, `y`) (coordenadas
 * de página): el cromo «mira» al puntero. La distancia se normaliza con el
 * lado mayor del cromo, así que el puntero puede estar sobre el vecino y el
 * cromo sigue girando hacia él, sin pasar nunca de `max`.
 */
export function targetTilt(x: number, y: number, rect: Rect, max = TILT_MAX_DEG): Tilt {
  const reach = Math.max(rect.width, rect.height, 1);
  const nx = clamp((x - (rect.left + rect.width / 2)) / reach, -1, 1);
  const ny = clamp((y - (rect.top + rect.height / 2)) / reach, -1, 1);
  // Puntero a la derecha → el borde derecho se aleja (giro Y positivo);
  // puntero abajo → el borde inferior se aleja (giro X negativo).
  return { rx: -ny * max, ry: nx * max };
}

export interface SpringState {
  x: number;
  v: number;
}

/**
 * Un paso de un muelle amortiguado de masa 1 (Euler semi-implícito). `dt` en
 * segundos, acotado a 1/30 s para que una pestaña que vuelve de segundo plano
 * no dé un salto.
 */
export function stepSpring(state: SpringState, target: number, dt: number): SpringState {
  const h = clamp(dt, 0, 1 / 30);
  const a = -SPRING.stiffness * (state.x - target) - SPRING.damping * state.v;
  const v = state.v + a * h;
  return { x: state.x + v * h, v };
}

/** ¿Ha llegado el muelle (y se puede parar el bucle de pintado)? */
export function isSettled(state: SpringState, target: number): boolean {
  return Math.abs(state.x - target) < 0.01 && Math.abs(state.v) < 0.01;
}

/** `transform` CSS del cromo para una inclinación. */
export function tiltTransform({ rx, ry }: Tilt): string {
  return `perspective(${TILT_PERSPECTIVE_PX}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
}

export interface TiltEnvironment {
  reducedMotion: boolean;
  /** `(hover: hover) and (pointer: fine)`. */
  finePointer: boolean;
  /** Ancho de la ventana en px. */
  width: number;
  webgl: boolean;
  saveData: boolean;
  /** `navigator.hardwareConcurrency` (0 si el navegador no lo da). */
  cores: number;
}

/**
 * Qué pintor lleva el podio:
 * - `none`: movimiento reducido, móvil o tableta (sin puntero que seguir): el
 *   podio queda quieto (el brillo sigue, salvo con movimiento reducido);
 * - `css`: puntero fino pero sin WebGL, con ahorro de datos o equipo justo;
 * - `webgl`: escritorio capaz: three.js, cargado después de pintar y en reposo.
 */
export function tiltMode(env: TiltEnvironment): "none" | "css" | "webgl" {
  if (env.reducedMotion || !env.finePointer) return "none";
  if (env.width < 768) return "none";
  if (!env.webgl || env.saveData || (env.cores > 0 && env.cores < 4)) return "css";
  return "webgl";
}
