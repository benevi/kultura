"use client";

// ============================================================
// KULTURA — «Guardar» de los rankings (una sola isla por página)
// Los enlaces «Guardar» son `<a data-best-save>` del servidor que llevan a
// la ficha (sin JS, ahí se añade). Esta isla escucha los toques en todo el
// documento (un solo listener, no 20 componentes) y los manda a su destino:
// sin cuenta abierta, al alta con vuelta a la ficha para guardarlo; con la cuenta abierta, a la
// ficha directamente (ver `lib/best/save.ts`).
//
// Esconde también la barra de alta (`[data-best-signup]`) si la cuenta está abierta: en un
// ranking cacheado el servidor no lo sabe.
// ============================================================

import { useEffect } from "react";
import { hasSessionCookie, saveDestination } from "@/lib/best/save";

export function BestSaveEnhancer({ locale }: { locale: string }) {
  useEffect(() => {
    const signedIn = () => hasSessionCookie(document.cookie);
    if (signedIn()) {
      for (const bar of Array.from(document.querySelectorAll<HTMLElement>("[data-best-signup]"))) {
        // `hidden` solo no basta: la barra lleva `flex` en la clase.
        bar.hidden = true;
        bar.style.display = "none";
      }
    }
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.<HTMLAnchorElement>("a[data-best-save]");
      if (!link) return;
      e.preventDefault();
      window.location.assign(saveDestination(locale, link.getAttribute("href") ?? "/", signedIn()));
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [locale]);
  return null;
}
