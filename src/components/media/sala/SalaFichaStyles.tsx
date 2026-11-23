"use client";

// Las hojas de «Sala» de la ficha (fase 8.5, F1). Este módulo solo se carga
// con `next/dynamic` desde `SalaFichaAssets`, así que Next enlaza sus hojas
// únicamente en la petición que pinta la sala (F4: también `poster.css`, la
// vertical que llena la sala): con `SALA_FICHA` apagada, la
// ficha no las pide. `fonts-jp.css` y `fonts-kr.css` las pide `SalaScriptFonts`
// cuando hay un texto en esa escritura.
import "@/styles/sala/tokens.css";
import "@/styles/sala/fonts.css";
import "@/styles/sala/title.css";
import "@/styles/sala/poster.css";

export default function SalaFichaStyles() {
  return null;
}
