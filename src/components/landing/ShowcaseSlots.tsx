// ============================================================
// KULTURA — Huecos que esperan a las portadas (E-LANDING-SHOWCASE)
//
// Componentes ASÍNCRONOS: resuelven la muestra y pintan la versión con
// portadas. Van dentro de un `<Suspense>` cuyo fallback es EL MISMO componente
// con `items={[]}` (su versión de gradientes), así que:
//   - el primer pintado de la landing no espera a ningún proveedor;
//   - cuando la muestra llega (o no), el hueco se rellena solo;
//   - con la caché caliente (un día) el HTML ya sale con las portadas.
//
// `getLandingShowcase` está memoizada por render (`cache()` de React), así que
// los dos huecos (collage de escritorio y tira de móvil) comparten una sola
// carga.
// ============================================================

import { HeroCollage, HeroStrip, HERO_COLLAGE_SLOTS } from "@/components/landing/HeroCollage";
import { getLandingShowcase } from "@/lib/landing/showcase";

export async function HeroCollageSlot({
  locale,
  badge,
}: {
  locale: string;
  badge: string;
}) {
  const showcase = await getLandingShowcase(locale);
  return <HeroCollage items={showcase.slice(0, HERO_COLLAGE_SLOTS)} badge={badge} />;
}

export async function HeroStripSlot({ locale }: { locale: string }) {
  const showcase = await getLandingShowcase(locale);
  return <HeroStrip items={showcase} />;
}
