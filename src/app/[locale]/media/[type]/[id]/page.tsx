// ============================================================
// KULTURA — Ficha de un título (PÚBLICA, D-01)
// Ruta: /[locale]/media/[type]/[id]
// Tipos: movie, tv, anime, manga, book, comic, game
//
// Vive FUERA de `(app)`: cualquiera la abre sin cuenta (enlaces de perfiles,
// listas, rankings y buscadores). Con sesión, `media/layout.tsx` pone la
// cabecera y la barra de la app y aquí se añaden biblioteca y afinidad; sin
// sesión, cabecera pública y CTA "Añadir a mi biblioteca" → registro con
// `next` de vuelta a esta ficha.
//
// Con la bandera `FICHA_ISR` encendida, el middleware manda a los visitantes
// sin sesión a la copia cacheable (`app/[locale]/media-anonima`); esta sigue
// siendo la de quien tiene sesión o la cookie de prueba de «Sala».
//
// Datos del proveedor: 24 h en la caché de datos (`loadMediaDetail`). Lo del
// usuario (biblioteca, afinidad) se pide aparte y nunca se cachea. Metadatos y
// pintado: `src/lib/media/ficha-page.tsx`.
// ============================================================

import * as React from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getViewer } from "@/lib/media/viewer";
import { loadMediaDetail } from "@/lib/media/detail-data";
import { salaFichaEnabled } from "@/lib/flags/sala";
import { fichaMetadata, renderFicha } from "@/lib/media/ficha-page";

interface Props {
  params: Promise<{ locale: string; type: string; id: string }>;
}

// `React.cache` existe en el React de servidor de Next; en tests, la función.
const dedupe: <T extends (...args: never[]) => unknown>(fn: T) => T =
  (React as unknown as { cache?: <T>(fn: T) => T }).cache ?? ((fn) => fn);

/** Metadatos y página piden la misma ficha: una sola carga por petición. */
const loadDetail = dedupe(loadMediaDetail);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, type, id } = await params;
  return fichaMetadata(locale, await loadDetail(type, id, locale));
}

export default async function MediaDetailPage({ params }: Props) {
  const { locale, type, id } = await params;
  const data = await loadDetail(type, id, locale);
  if (!data) notFound();
  const viewer = await getViewer();
  return renderFicha({ locale, data, viewer, sala: salaFichaEnabled() });
}
