// ============================================================
// KULTURA — Movimiento del álbum (DISENO.md · Movimiento)
//
// Duraciones 180 / 240 / 360 ms y cambio de ruta 200 ms; curvas «out»
// (cubic-bezier(.2,.8,.2,1)) y «pegar» (cubic-bezier(.3,1.3,.5,1), con un
// pequeño rebote). Todo instantáneo con prefers-reduced-motion.
//
// GSAP solo para secuencias orquestadas (el pegado escalonado de una
// rejilla, el sobre más adelante) y SIEMPRE con import dinámico: nunca
// entra en el JS inicial de una ruta (presupuesto ≤ 150 KB). Para un hover
// o un pegado suelto bastan las transiciones CSS (`.cromo`, `.animate-paste`).
// ============================================================

export const DURATION = { fast: 180, base: 240, slow: 360, route: 200 } as const;
export const EASE = {
  out: "cubic-bezier(0.2, 0.8, 0.2, 1)",
  paste: "cubic-bezier(0.3, 1.3, 0.5, 1)",
} as const;

/** Pegado escalonado: 40 ms entre cromos y nunca más de 600 ms en total. */
export const PASTE_STEP_MS = 40;
export const PASTE_MAX_MS = 600;

/**
 * ¿Pidió la persona menos movimiento? Sin `matchMedia` (servidor, tests) se
 * responde que sí: ante la duda, no se anima.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type Gsap = typeof import("gsap").gsap;
let gsapPromise: Promise<Gsap> | null = null;

/** GSAP bajo demanda (un solo import dinámico por página, memorizado). */
export function loadGsap(): Promise<Gsap> {
  if (!gsapPromise) {
    gsapPromise = import("gsap").then((m) => m.gsap ?? m.default).catch((err) => {
      gsapPromise = null;
      throw err;
    });
  }
  return gsapPromise;
}

/**
 * Curva cúbica de Bézier como función de GSAP (t ∈ [0, 1] → progreso), para
 * usar exactamente las curvas del sistema sin cargar el plugin CustomEase.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const err = sampleX(t) - x;
      const d = slopeX(t);
      if (Math.abs(err) < 1e-5 || Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    return sampleY(Math.min(1, Math.max(0, t)));
  };
}

export const easePaste = cubicBezier(0.3, 1.3, 0.5, 1);
export const easeOut = cubicBezier(0.2, 0.8, 0.2, 1);

/**
 * Calendario del pegado de `count` cromos: cada uno dura 240 ms y empieza
 * 40 ms después del anterior; si no cabe en 600 ms, el paso se reduce. Puro,
 * para poder comprobarlo sin navegador.
 */
export function pasteSchedule(count: number): { duration: number; stagger: number; total: number } {
  const duration = DURATION.base;
  if (count <= 1) return { duration, stagger: 0, total: count > 0 ? duration : 0 };
  const stagger = Math.min(PASTE_STEP_MS, (PASTE_MAX_MS - duration) / (count - 1));
  return { duration, stagger, total: duration + stagger * (count - 1) };
}

/**
 * Pega una vez, en cascada, los cromos de una rejilla: cada uno cae un poco
 * (8 px, escala 1,04, −2°) y se asienta con la curva de pegar. Parte de un
 * estado VISIBLE (no anima la opacidad): sin JS o si falla, la rejilla se ve
 * igual. No hace nada con movimiento reducido. Devuelve si animó.
 */
export async function pasteGrid(elements: ArrayLike<Element> | Element[]): Promise<boolean> {
  if (prefersReducedMotion() || typeof HTMLElement === "undefined") return false;
  const list = Array.from(elements).filter((el): el is HTMLElement => el instanceof HTMLElement);
  if (list.length === 0) return false;
  const gsap = await loadGsap();
  const { duration, stagger } = pasteSchedule(list.length);
  gsap.fromTo(
    list,
    { y: -8, scale: 1.04, rotation: -2 },
    {
      y: 0,
      scale: 1,
      rotation: 0,
      duration: duration / 1000,
      stagger: stagger / 1000,
      ease: easePaste,
      clearProps: "transform",
      overwrite: "auto",
    }
  );
  return true;
}
