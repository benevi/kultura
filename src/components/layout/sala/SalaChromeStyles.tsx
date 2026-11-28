"use client";

// Las hojas de «Sala» del armazón (fase 8.5 M2). Este módulo solo se carga
// con `next/dynamic` desde `SalaChromeAssets`, así que Next enlaza sus hojas
// únicamente en la petición que pinta la cabecera pública de «Sala»: con
// `SALA_MARCA` apagada, las páginas públicas no las piden.
import "@/styles/sala/tokens.css";
import "@/styles/sala/fonts.css";

export default function SalaChromeStyles() {
  return null;
}
