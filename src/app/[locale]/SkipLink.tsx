"use client";

import { useEffect, type MouseEvent } from "react";
import { usePathname } from "next/navigation";

/** Marca de los destinos a los que el propio enlace ha puesto `id="main"`. */
const MARK = "data-skip-target";

/** Lo primero que sigue a la cabecera del sitio (sin contar navegaciones). */
function afterSiteHeader(): HTMLElement | null {
  let el = document.querySelector("body header")?.nextElementSibling ?? null;
  while (el && (el.tagName === "NAV" || el.tagName === "SCRIPT" || el.getAttribute("role") === "navigation")) {
    el = el.nextElementSibling;
  }
  return el instanceof HTMLElement ? el : null;
}

/**
 * Destino del salto: el `<main>` de la pantalla; si la pantalla no tiene
 * (ficha, búsqueda, restablecer contraseña…), lo que sigue a la cabecera del
 * sitio; y si tampoco hay cabecera, el h1. Nunca la cabecera.
 */
export function findSkipTarget(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>("main") ??
    afterSiteHeader() ??
    document.querySelector<HTMLElement>("h1")
  );
}

/**
 * Deja el destino con `id="main"` (el ancla existe aunque la pantalla no lo
 * ponga) y enfocable por código. Al cambiar de pantalla quita el id que puso
 * en el destino anterior, para no dejar el ancla en un sitio viejo.
 */
function markTarget(): HTMLElement | null {
  const target = findSkipTarget();
  document.querySelectorAll<HTMLElement>(`[${MARK}]`).forEach((el) => {
    if (el === target) return;
    el.removeAttribute(MARK);
    if (el.id === "main") el.removeAttribute("id");
  });
  if (!target) return null;
  if (!target.id && !document.getElementById("main")) {
    target.id = "main";
    target.setAttribute(MARK, "");
  }
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  return target;
}

/**
 * ACC-13: primer elemento enfocable de cada página. Con JS enfoca el destino
 * de `findSkipTarget`; sin JS salta a `#main` (las 404 y el error global lo
 * llevan de serie).
 */
export function SkipLink({ label }: { label: string }) {
  const pathname = usePathname();

  useEffect(() => {
    markTarget();
  }, [pathname]);

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    const target = markTarget();
    if (!target) return;
    event.preventDefault();
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "start" });
  }

  return (
    <a
      href="#main"
      onClick={onClick}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:inline-flex focus:h-11 focus:items-center focus:rounded-pill focus:bg-accent-pink focus:px-5 focus:font-body focus:text-sm focus:font-extrabold focus:text-on-accent-pink focus:outline-none focus:ring-2 focus:ring-accent-pink focus:ring-offset-2 focus:ring-offset-surface-base"
    >
      {label}
    </a>
  );
}
