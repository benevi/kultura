"use client";

import { useEffect } from "react";
import type { SalaScript } from "@/lib/design/sala-title";

/**
 * Carga las fuentes de japonés y coreano de «Sala» solo donde hay un texto en
 * esa escritura, y después de pintar.
 *
 * Las hojas `fonts-jp.css` y `fonts-kr.css` son largas (120 y 91 reglas, una
 * por trozo de fuente): si fueran en el CSS de la página, la bloquearían en
 * todas las fichas, tengan o no un título en japonés. Aquí se piden con
 * `import()`: el empaquetador las saca a un archivo aparte, que se baja
 * cuando este componente se monta. Mientras tanto el texto se ve con la
 * fuente japonesa o coreana del sistema, que ocupa lo mismo (un em por
 * carácter): al llegar Noto cambia el trazo, no la caja.
 *
 * Quien lo pinta decide con `salaScripts()` si hace falta; sin escrituras no
 * se pinta y la página no carga este código. Sin JavaScript, el texto se
 * queda con la fuente del sistema.
 */
const HOJAS: Record<SalaScript, () => Promise<unknown>> = {
  jp: () => import("@/styles/sala/fonts-jp.css"),
  kr: () => import("@/styles/sala/fonts-kr.css"),
};

export function SalaScriptFonts({ scripts }: { scripts: readonly SalaScript[] }) {
  const clave = scripts.join(" ");
  useEffect(() => {
    for (const script of clave.split(" ").filter(Boolean) as SalaScript[]) {
      // Si la hoja no llega, el texto sigue con la fuente del sistema: no hay nada que avisar.
      void HOJAS[script]?.().catch(() => undefined);
    }
  }, [clave]);
  return null;
}
