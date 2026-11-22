"use client";

import dynamic from "next/dynamic";

/**
 * Las hojas de «Sala» de la ficha (fase 8.5, F1: `tokens.css`, `fonts.css`,
 * `title.css`), por `next/dynamic`: Next solo enlaza las hojas de un módulo
 * dinámico en la petición que lo pinta. Con `SALA_FICHA` apagada, la ficha no
 * las pide. La precarga de Anybody la hace `SalaFichaHero` en el servidor.
 */
const SalaFichaStyles = dynamic(() => import("./SalaFichaStyles"));

export function SalaFichaAssets() {
  return <SalaFichaStyles />;
}
