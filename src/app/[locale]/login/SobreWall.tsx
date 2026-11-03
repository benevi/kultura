import { getLandingShowcase } from "@/lib/landing/showcase";
import { STAGE_MAX_CROMOS } from "./sobre-layout";
import { SobreStage } from "./SobreStage";

/**
 * Las portadas del sobre: la misma muestra real del catálogo que la portada
 * (en caché un día, una por formato primero). Llega por `<Suspense>`: el
 * formulario no la espera. Sin muestra, el abanico queda en huecos vacíos.
 */
export async function SobreWall({ locale, className }: { locale: string; className?: string }) {
  const showcase = await getLandingShowcase(locale);
  return <SobreStage covers={showcase.slice(0, STAGE_MAX_CROMOS)} className={className} />;
}
