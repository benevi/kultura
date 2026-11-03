"use client";

import { useEffect, useRef, type RefObject } from "react";
import { pasteGrid } from "@/lib/motion";

export interface UsePasteGridOptions {
  /**
   * Cuándo se pega:
   * - `mount` (por defecto, el de la app): al montar, sin depender del
   *   scroll (dentro de la app nada va ligado al scroll);
   * - `enter` (páginas públicas): la primera vez que la rejilla entra en
   *   pantalla.
   */
  trigger?: "mount" | "enter";
  /** Qué hijos se pegan. Por defecto, los cromos (`.cromo`). */
  selector?: string;
  /** Desactivar (p. ej. mientras la rejilla es un esqueleto). */
  enabled?: boolean;
}

/**
 * Una sola vez por rejilla y página: el pegado escalonado de sus cromos
 * (`pasteGrid`). GSAP se carga en ese momento, no antes.
 */
export function usePasteGrid<T extends HTMLElement>(
  ref: RefObject<T | null>,
  { trigger = "mount", selector = ".cromo", enabled = true }: UsePasteGridOptions = {}
): void {
  const done = useRef(false);

  useEffect(() => {
    const root = ref.current;
    if (!enabled || done.current || !root) return;
    const run = () => {
      if (done.current) return;
      done.current = true;
      void pasteGrid(root.querySelectorAll(selector)).catch(() => {});
    };
    if (trigger === "mount" || typeof IntersectionObserver === "undefined") {
      run();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          run();
        }
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    io.observe(root);
    return () => io.disconnect();
  }, [ref, trigger, selector, enabled]);
}
