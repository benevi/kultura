// ============================================================
// KULTURA — Hueco que espera a las portadas (E-LANDING-SHOWCASE)
//
// Componente ASÍNCRONO: resuelve la muestra y pinta el hero inmersivo con las
// portadas reales (E-LANDING-INMERSIVA). Va dentro de un `<Suspense>` cuyo
// fallback es EL MISMO hero con `items={[]}` (galería de gradientes F0), así que:
//   - el primer pintado de la landing no espera a ningún proveedor;
//   - cuando la muestra llega (o no), el hueco se rellena solo;
//   - con la caché caliente (un día) el HTML ya sale con las portadas.
//
// Además PRECARGA las portadas de las primeras piezas: el navegador empieza a
// descargarlas con el HTML, en paralelo al JS, en vez de esperar a que
// hidrate React, llegue three.js y la escena las pida. Misma URL y mismo
// `crossOrigin` que usa el TextureLoader (anonymous), o la precarga no se
// reaprovecha y la imagen se baja dos veces.
// ============================================================

import { preload } from "react-dom";
import { ImmersiveHero } from "@/components/landing/ImmersiveHero";
import { FeatureGrid, type FeatureGridProps } from "@/components/landing/FeatureGrid";
import { BestRankings, type BestRankingsProps } from "@/components/landing/BestRankings";
import { BEST_FORMATS, getBestOf, type BestFormat, type BestItem } from "@/lib/best/best-of";
import { IMMERSIVE_READY_AT, textureUrl, type ImmersiveCopy } from "@/lib/landing/immersive";
import { getLandingShowcase } from "@/lib/landing/showcase";

export async function ImmersiveHeroSlot({
  locale,
  copy,
}: {
  locale: string;
  copy: ImmersiveCopy;
}) {
  const showcase = await getLandingShowcase(locale);
  for (const item of showcase.slice(0, IMMERSIVE_READY_AT)) {
    preload(textureUrl(item.poster), { as: "image", crossOrigin: "anonymous", fetchPriority: "high" });
  }
  return <ImmersiveHero items={showcase} copy={copy} />;
}

/** Features con portadas reales; el fallback del Suspense es la misma rejilla sin ellas. */
export async function FeatureGridSlot({
  locale,
  features,
}: {
  locale: string;
  features: FeatureGridProps["features"];
}) {
  const showcase = await getLandingShowcase(locale);
  return <FeatureGrid features={features} posters={showcase} />;
}

/** Rankings con las tres primeras portadas de cada uno. Un ranking caído = su card en gradiente. */
export async function BestRankingsSlot({
  locale,
  ...props
}: { locale: string } & Omit<BestRankingsProps, "tops">) {
  const entries = await Promise.all(
    BEST_FORMATS.map(async (f) => {
      const items = await getBestOf(f, props.year, locale).catch(() => [] as BestItem[]);
      return [f, items.slice(0, 3)] as const;
    })
  );
  const tops = Object.fromEntries(entries) as Partial<Record<BestFormat, BestItem[]>>;
  return <BestRankings {...props} tops={tops} />;
}
