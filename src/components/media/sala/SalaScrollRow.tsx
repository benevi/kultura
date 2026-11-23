"use client";

import type { FocusEvent, HTMLAttributes } from "react";

/**
 * Una fila que se desliza en horizontal (F2c, «Dónde ver»). Lo único que
 * añade a un `<div>` es esto: cuando algo de dentro recibe el foco, la fila se
 * mueve hasta enseñarlo entero. Chrome solo la mueve si el elemento está fuera
 * del todo; si asoma a medias, el anillo de foco se queda cortado en el borde
 * (WCAG 2.4.11). Respeta `scroll-padding`. Con `block: "nearest"` la página
 * también puede moverse en vertical, pero solo lo justo para que el elemento
 * quepa en la pantalla (si ya cabe, no se mueve). Solo con el foco de teclado
 * (`:focus-visible`): un clic o un toque no desplaza la fila bajo el dedo.
 * Con movimiento reducido, el salto es inmediato.
 */
export function SalaScrollRow({ onFocus, ...props }: HTMLAttributes<HTMLDivElement>) {
  function handleFocus(event: FocusEvent<HTMLDivElement>) {
    onFocus?.(event);
    if (event.target === event.currentTarget) return;
    if (!(event.target as Element).matches?.(":focus-visible")) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    event.target.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: reduce ? "auto" : "smooth" });
  }
  return <div {...props} onFocus={handleFocus} />;
}
