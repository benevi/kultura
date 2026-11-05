"use client";

/**
 * Posición del cursor en coordenadas normalizadas (−1…1), suavizada. La lee
 * cualquier pieza de la escena en su `useFrame` sin pasar props: la luz, la
 * inclinación de los objetos, la cámara. Sin cursor (táctil, o antes del
 * primer movimiento) deriva despacio para que la escena nunca esté muerta.
 */
export const pointer = { x: 0, y: 0, tx: 0, ty: 0, has: false };

let listening = false;
export function listenPointer(): () => void {
  if (listening) return () => {};
  listening = true;
  const move = (e: PointerEvent) => {
    pointer.has = true;
    pointer.tx = (e.clientX / innerWidth) * 2 - 1;
    pointer.ty = -((e.clientY / innerHeight) * 2 - 1);
  };
  addEventListener("pointermove", move, { passive: true });
  return () => {
    removeEventListener("pointermove", move);
    listening = false;
  };
}

/** Un paso del suavizado, llamado una vez por fotograma desde la escena. */
export function stepPointer(dt: number, t: number): void {
  if (!pointer.has) {
    pointer.tx = Math.sin(t * 0.35) * 0.45;
    pointer.ty = Math.cos(t * 0.27) * 0.25;
  }
  const k = 1 - Math.exp(-dt * 4);
  pointer.x += (pointer.tx - pointer.x) * k;
  pointer.y += (pointer.ty - pointer.y) * k;
}
