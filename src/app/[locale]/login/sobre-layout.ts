// ============================================================
// KULTURA — El sobre de la portada de acceso: geometría compartida
//
// El abanico de cromos que sale del sobre se pinta dos veces: en HTML (lo que
// ve todo el mundo desde el primer pintado, también sin JavaScript) y, en
// escritorios capaces, en three.js encima, con profundidad. Las dos versiones
// salen de ESTAS cuentas para que, al cambiar de una a otra, ningún cromo se
// mueva de sitio.
//
// Todo va en fracciones del ancho del escenario (W); el alto es W · ASPECT.
// Los ángulos, en grados y en el sentido de CSS (positivo = horario).
// ============================================================

/** Alto / ancho del escenario. */
export const STAGE_ASPECT = 0.8;
/** Cromos como mucho (uno por formato). */
export const STAGE_MAX_CROMOS = 7;

export const CROMO_W = 0.3;
export const CROMO_H = CROMO_W * 1.5;

export const SOBRE_W = 0.66;
export const SOBRE_H = 0.34;
/** Borde superior del sobre (la boca rasgada), en fracciones de W. */
export const MOUTH_Y = STAGE_ASPECT - SOBRE_H;
/** Profundidad de la base de cada cromo dentro del sobre (la tapa la oculta). */
const DEPTH = 0.11;
const SPREAD_DEG = 26;
const X_STEP = 0.12;

/** Entrada del abanico: lo que baja cada cromo dentro del sobre y cuánto gira al salir. */
export const TUCK_DROP = 0.55;
export const TUCK_TURN = 0.35;

/** Cada cromo: centro de su base (x, bottom) y giro. */
export interface CromoPose {
  x: number;
  bottom: number;
  angle: number;
}

/** El abanico abierto de `n` cromos (el más alto, en el centro). */
export function fanPoses(n: number): CromoPose[] {
  const count = Math.max(0, Math.min(STAGE_MAX_CROMOS, Math.floor(n)));
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
    return { x: 0.5 + t * X_STEP, bottom: MOUTH_Y + DEPTH, angle: t * SPREAD_DEG };
  });
}

/** Caja CSS de un cromo en porcentajes del escenario (left/top/width). */
export function cromoBox(pose: CromoPose): { left: number; top: number; width: number } {
  return {
    left: (pose.x - CROMO_W / 2) * 100,
    top: ((pose.bottom - CROMO_H) / STAGE_ASPECT) * 100,
    width: CROMO_W * 100,
  };
}

/** ¿Las cuatro esquinas de la base quedan dentro del sobre (bajo la boca)? */
export function baseHidden(pose: CromoPose): boolean {
  const a = (Math.abs(pose.angle) * Math.PI) / 180;
  return pose.bottom - (CROMO_W / 2) * Math.sin(a) > MOUTH_Y + TEETH_DEPTH;
}

/** ¿El cromo cabe entero en el escenario? */
export function insideStage(pose: CromoPose): boolean {
  const a = (Math.abs(pose.angle) * Math.PI) / 180;
  const top = pose.bottom - CROMO_H * Math.cos(a) - (CROMO_W / 2) * Math.sin(a);
  const reach = CROMO_H * Math.sin(a) + (CROMO_W / 2) * Math.cos(a);
  return top >= 0 && pose.x - reach >= 0 && pose.x + reach <= 1;
}

/** Índice del cromo bajo el puntero (el de encima gana) o -1. Coordenadas en fracciones de W. */
export function cromoAt(px: number, py: number, poses: CromoPose[]): number {
  if (py >= MOUTH_Y) return -1;
  for (let i = poses.length - 1; i >= 0; i--) {
    const p = poses[i];
    const a = (p.angle * Math.PI) / 180;
    const dx = px - p.x;
    const dy = py - p.bottom;
    // Al marco del cromo (girado `a` en sentido horario).
    const lx = dx * Math.cos(a) + dy * Math.sin(a);
    const ly = -dx * Math.sin(a) + dy * Math.cos(a);
    if (Math.abs(lx) <= CROMO_W / 2 && ly <= 0 && ly >= -CROMO_H) return i;
  }
  return -1;
}

// ── El sobre ────────────────────────────────────────────────────────────────

/** Dientes del borde rasgado y su profundidad (fracción de W). */
const TEETH = 12;
export const TEETH_DEPTH = 0.026;

/** Caja de la tapa del sobre en porcentajes del escenario. */
export const SOBRE_BOX = {
  left: ((1 - SOBRE_W) / 2) * 100,
  width: SOBRE_W * 100,
  height: (SOBRE_H / STAGE_ASPECT) * 100,
};

/** viewBox de la tapa: 100 de ancho y el alto en proporción. */
export const SOBRE_VIEWBOX_H = (SOBRE_H / SOBRE_W) * 100;

/** Contorno de la tapa (puntos SVG en el viewBox): boca en zigzag y base recta. */
export function sobrePoints(): string {
  const tooth = (TEETH_DEPTH / SOBRE_W) * 100;
  const pts: string[] = [];
  for (let k = 0; k <= TEETH * 2; k++) {
    const x = (k / (TEETH * 2)) * 100;
    pts.push(`${round(x)},${round(k % 2 === 0 ? tooth : 0)}`);
  }
  pts.push(`100,${round(SOBRE_VIEWBOX_H)}`, `0,${round(SOBRE_VIEWBOX_H)}`);
  return pts.join(" ");
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Tiempos de la salida (CSS) ──────────────────────────────────────────────

/** Duración de cada cromo (duration-slow) y tope de toda la salida. */
export const BURST_MS = 360;
export const BURST_MAX_MS = 600;

/** Retardo de cada cromo: 40 ms entre uno y otro sin pasar de 600 ms en total. */
export function burstDelays(n: number): number[] {
  if (n <= 1) return n === 1 ? [0] : [];
  const step = Math.min(40, (BURST_MAX_MS - BURST_MS) / (n - 1));
  return Array.from({ length: n }, (_, i) => Math.round(i * step));
}
