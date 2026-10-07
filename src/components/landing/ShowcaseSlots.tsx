// ============================================================
// KULTURA — Hueco que espera a las portadas (E-LANDING-SHOWCASE)
//
// Componente ASÍNCRONO: resuelve la muestra y pinta el hero inmersivo con las
// portadas reales (E-LANDING-INMERSIVA). Va dentro de un `<Suspense>` cuyo
// fallback es EL MISMO hero con `items={[]}` (galería de gradientes F0), así que:
//   - el primer pintado de la landing no espera a ningún proveedor;
//   - cuando la muestra llega (o no), el hueco se rellena solo;
//   - con la caché caliente (un día) el HTML ya sale con las portadas.
// ============================================================

import { ImmersiveHero } from "@/components/landing/ImmersiveHero";
import type { ImmersiveCopy } from "@/lib/landing/immersive";
import { getLandingShowcase } from "@/lib/landing/showcase";

export async function ImmersiveHeroSlot({
  locale,
  copy,
}: {
  locale: string;
  copy: ImmersiveCopy;
}) {
  const showcase = await getLandingShowcase(locale);
  return <ImmersiveHero items={showcase} copy={copy} />;
}
