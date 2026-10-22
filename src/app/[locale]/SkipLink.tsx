"use client";

import { useEffect, type MouseEvent } from "react";
import { usePathname } from "next/navigation";

/** El `<main>` de la página: el que ya tenga `id="main"` o, si no, el primero. */
function findMain(): HTMLElement | null {
  return document.getElementById("main") ?? document.querySelector("main");
}

/** Destino enfocable por código (no entra en el orden de Tab). */
function prepareTarget(main: HTMLElement) {
  if (!main.id) main.id = "main";
  if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
}

/**
 * ACC-13: primer elemento enfocable de cada página. Sin JS salta a `#main`
 * (las 404 y el error global ya lo llevan); con JS, en cada cambio de ruta
 * marca como destino el `<main>` que pinte la pantalla, aunque no traiga el
 * id, así el ancla existe y el lector de pantalla y el siguiente Tab empiezan
 * en el contenido y no en la cabecera.
 */
export function SkipLink({ label }: { label: string }) {
  const pathname = usePathname();

  useEffect(() => {
    const main = findMain();
    if (main) prepareTarget(main);
  }, [pathname]);

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    const main = findMain();
    if (!main) return;
    event.preventDefault();
    prepareTarget(main);
    main.focus({ preventScroll: true });
    main.scrollIntoView({ block: "start" });
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
