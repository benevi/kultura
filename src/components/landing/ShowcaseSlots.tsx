// ============================================================
// KULTURA — Huecos que esperan a las portadas (E-LANDING-SHOWCASE)
//
// Componentes ASÍNCRONOS: resuelven la muestra y pintan el bloque con las
// portadas reales. Van dentro de un `<Suspense>` cuyo fallback es EL MISMO
// bloque sin portadas (gradientes F0), así que (el texto del hero ni siquiera
// está aquí: es HTML de `Hero`, fuera de todo Suspense):
//   - el primer pintado de la landing no espera a ningún proveedor;
//   - cuando la muestra llega (o no), el hueco se rellena solo;
//   - con la caché caliente (un día) el HTML ya sale con las portadas.
//
// Precargas del hero (REN-4, MOV-13): solo las 4 portadas más cercanas a la
// cámara, con prioridad alta, y SOLO donde habrá galería (`SCENE_MEDIA`:
// ≥ 768 px y sin reducir movimiento). En el móvil no se descarga ninguna
// textura. Misma URL y mismo `crossOrigin` que usa la escena, o la precarga no
// se reaprovecha y la imagen se baja dos veces.
// ============================================================

import { ImmersiveBackdrop } from "@/components/landing/ImmersiveBackdrop";
import { HeroStrip } from "@/components/landing/HeroCollage";
import { FeatureGrid, type FeatureGridProps } from "@/components/landing/FeatureGrid";
import { BestRankings, type BestRankingsProps } from "@/components/landing/BestRankings";
import { HowItWorks, type HowItWorksProps } from "@/components/landing/HowItWorks";
import { BEST_FORMATS, getBestOf, type BestFormat, type BestItem } from "@/lib/best/best-of";
import { IMMERSIVE_PRELOAD, SCENE_MEDIA, textureUrl } from "@/lib/landing/immersive";
import { getLandingShowcase, isLandscapePoster } from "@/lib/landing/showcase";

/** Fondo del hero (galería o collage) con sus precargas. */
export async function HeroBackdropSlot({ locale }: { locale: string }) {
  const showcase = await getLandingShowcase(locale);
  return (
    <>
      {showcase.slice(0, IMMERSIVE_PRELOAD).map((item) => (
        <link
          key={item.id}
          rel="preload"
          as="image"
          href={textureUrl(item.poster)}
          crossOrigin="anonymous"
          fetchPriority="high"
          media={SCENE_MEDIA}
        />
      ))}
      <ImmersiveBackdrop items={showcase} />
    </>
  );
}

/** Tira de portadas del hero en móvil (bajo los botones). */
export async function HeroStripSlot({ locale }: { locale: string }) {
  const showcase = await getLandingShowcase(locale);
  return <HeroStrip items={showcase} />;
}

/** Features con portadas reales; el fallback del Suspense es la misma rejilla sin ellas. */
export async function FeatureGridSlot({
  locale,
  ...props
}: { locale: string } & Omit<FeatureGridProps, "posters">) {
  const showcase = await getLandingShowcase(locale);
  return <FeatureGrid {...props} posters={showcase} />;
}

/** "Así funciona" con portadas reales (las siguientes a las de features). */
export async function HowItWorksSlot({
  locale,
  ...props
}: { locale: string } & Omit<HowItWorksProps, "posters">) {
  const showcase = await getLandingShowcase(locale);
  return <HowItWorks {...props} posters={showcase} />;
}

/**
 * Rankings con las tres primeras portadas de cada uno. Un ranking caído = su
 * card en gradiente. Las capturas apaisadas (juegos de RAWG) no se recortan a
 * carátula: esa pieza queda en gradiente (DIS-4); el título sigue en texto.
 */
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
  const fans = Object.fromEntries(
    entries.map(([f, items]) => [f, items.map((it) => (isLandscapePoster(it.poster) ? null : it))])
  ) as Partial<Record<BestFormat, (BestItem | null)[]>>;
  return <BestRankings {...props} tops={tops} fans={fans} />;
}
