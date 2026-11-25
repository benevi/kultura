// ============================================================
// KULTURA — Ficha cacheable para visitantes sin sesión (bandera FICHA_ISR)
// Ruta interna: /[locale]/media-anonima/[type]/[id]. Nadie la abre por su
// nombre: el middleware reescribe aquí /[locale]/media/[type]/[id] cuando
// `FICHA_ISR=1`, la petición no trae cookie de sesión de Supabase ni la de
// prueba de «Sala», y responde 404 a quien pida esta ruta directamente.
//
// Es la misma ficha que ve hoy un visitante sin sesión (`renderFicha` sin
// usuario), guardada en la caché ISR y en el CDN: se genera en la primera
// visita y se renueva cada 6 h. Sin nonce: la CSP fija (D-02) la pone el
// middleware en la respuesta.
// ============================================================

import * as React from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { loadMediaDetailResult } from "@/lib/media/detail-data";
import { salaFlagMode } from "@/lib/flags/sala";
import { fichaMetadata, renderFicha } from "@/lib/media/ficha-page";

/** 6 h: la nota media de KULTURA y «Dónde ver» pueden ir hasta 6 h atrasados. */
export const revalidate = 21600;

// Ninguna ficha en el build: cada URL se genera en su primera visita
// (`dynamicParams` sigue en su valor por defecto, true).
export function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ locale: string; type: string; id: string }>;
}

// `React.cache` existe en el React de servidor de Next; en tests, la función.
const dedupe: <T extends (...args: never[]) => unknown>(fn: T) => T =
  (React as unknown as { cache?: <T>(fn: T) => T }).cache ?? ((fn) => fn);

/** Metadatos y página piden la misma ficha: una sola carga por petición. */
const loadResult = dedupe(loadMediaDetailResult);

/** Sin sesión: sin biblioteca, afinidad ni «Compartir mi nota». */
const ANONYMOUS = { user: null, profile: null };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, type, id } = await params;
  setRequestLocale(locale);
  const result = await loadResult(type, id, locale);
  return fichaMetadata(locale, result.status === "ok" ? result.data : null);
}

export default async function FichaAnonimaPage({ params }: Props) {
  const { locale, type, id } = await params;
  setRequestLocale(locale);
  const result = await loadResult(type, id, locale);
  // El título no existe: la 404 se puede guardar en la caché.
  if (result.status === "missing") notFound();
  // Proveedor caído o cuota: lanzar en vez de pintar una 404, que se quedaría
  // 6 h en la caché. Un error no se guarda (la próxima visita lo reintenta) y,
  // al renovar una ficha ya guardada, se sigue sirviendo la anterior.
  if (result.status === "unavailable") throw new Error("ficha no disponible ahora");

  return renderFicha({
    locale,
    data: result.data,
    viewer: ANONYMOUS,
    // «Sala» solo con la bandera en `1`: con `prueba` la ve quien trae la
    // cookie, y esas peticiones no llegan aquí (van a la ficha de siempre).
    sala: Promise.resolve(salaFlagMode(process.env.SALA_FICHA) === "on"),
  });
}
