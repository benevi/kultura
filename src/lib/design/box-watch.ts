// ============================================================
// KULTURA — Vigilar el tamaño de una caja en píxeles físicos
// ------------------------------------------------------------
// Para lo que depende de cuántos píxeles de pantalla ocupa una caja (el tope
// de ampliación de una imagen). Avisa al suscribirse, cuando la caja cambia de
// tamaño y cuando cambia la densidad de la pantalla sin que cambie la caja
// (zoom del navegador, ventana a otro monitor).
//
// Un solo `ResizeObserver` y una sola escucha de densidad para todo el módulo,
// se suscriban una caja o cien.
// ============================================================
import type { PixelSize } from "@/lib/design/image-fit";

export type BoxListener = (room: PixelSize, dpr: number) => void;

const cajas = new Map<Element, Set<BoxListener>>();
let observador: ResizeObserver | null = null;
let dejarDeEscucharDensidad: (() => void) | null = null;

function medir(caja: Element): { room: PixelSize; dpr: number } {
  const { width, height } = caja.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  return { room: { width: width * dpr, height: height * dpr }, dpr };
}

function avisar(caja: Element) {
  const avisos = cajas.get(caja);
  if (!avisos) return;
  const { room, dpr } = medir(caja);
  for (const aviso of Array.from(avisos)) aviso(room, dpr);
}

/** Una consulta de medios solo avisa al dejar de cumplirse: se vuelve a armar con la densidad nueva. */
function escucharDensidad() {
  if (typeof window.matchMedia !== "function") return;
  const consulta = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
  const alCambiar = () => {
    dejarDeEscucharDensidad?.();
    dejarDeEscucharDensidad = null;
    if (cajas.size === 0) return;
    escucharDensidad();
    for (const caja of Array.from(cajas.keys())) avisar(caja);
  };
  consulta.addEventListener("change", alCambiar);
  dejarDeEscucharDensidad = () => consulta.removeEventListener("change", alCambiar);
}

/**
 * Avisa con el tamaño de `caja` en píxeles físicos y la densidad: una vez ya,
 * de forma síncrona, y después cada vez que cambien. Devuelve cómo dejarlo.
 */
export function watchBox(caja: Element, aviso: BoxListener): () => void {
  let avisos = cajas.get(caja);
  if (!avisos) {
    avisos = new Set();
    cajas.set(caja, avisos);
    if (typeof ResizeObserver !== "undefined") {
      observador ??= new ResizeObserver((entradas) => {
        for (const entrada of entradas) avisar(entrada.target);
      });
      observador.observe(caja);
    }
  }
  avisos.add(aviso);
  if (!dejarDeEscucharDensidad) escucharDensidad();

  const { room, dpr } = medir(caja);
  aviso(room, dpr);

  return () => {
    const suyos = cajas.get(caja);
    if (!suyos) return;
    suyos.delete(aviso);
    if (suyos.size > 0) return;
    cajas.delete(caja);
    observador?.unobserve(caja);
    if (cajas.size === 0) {
      dejarDeEscucharDensidad?.();
      dejarDeEscucharDensidad = null;
    }
  };
}
