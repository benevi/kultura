// ============================================================
// KULTURA — Hero de la landing (D-11: hero único)
//
// Server Component: el mensaje (badge, h1, subtítulo y los dos botones) es
// HTML puro, fuera de cualquier `<Suspense>`. Se ve en el primer pintado, con
// o sin JavaScript, y sale UNA sola vez en el HTML (antes el hero entero iba
// dentro del Suspense y el h1 viajaba dos veces: en el respaldo y en el
// contenido en streaming).
//
// Lo que depende de las portadas va en dos huecos que entran por streaming:
//   - `backdrop`: la galería WebGL o el collage quieto (`ImmersiveBackdrop`);
//   - `strip`: la tira de portadas del móvil, bajo los botones.
//
// Mientras la galería presenta cada formato, su palabra se ilumina en el
// titular: el fondo pone `data-active="<formato>"` en esta sección y cada
// palabra tiene su regla (clases literales para que Tailwind las genere).
// ============================================================

import { Link } from "@/i18n/navigation";
import { KButton } from "@/components/ui/KButton";
import { DemoButton } from "@/components/landing/DemoButton";
import type { HeroCopy } from "@/lib/landing/immersive";
import type { MediaType } from "@/types/media";

/**
 * Color de cada palabra cuando su formato está en pantalla: `formatColor` de
 * cada formato, escrito literal para que Tailwind genere la regla (un test
 * comprueba que coinciden).
 */
export const ACTIVE_CLASS: Record<MediaType, string> = {
  movie: "group-data-[active=movie]/hero:text-[oklch(80%_0.2_350)]",
  tv: "group-data-[active=tv]/hero:text-[oklch(80%_0.2_300)]",
  anime: "group-data-[active=anime]/hero:text-[oklch(80%_0.2_130)]",
  manga: "group-data-[active=manga]/hero:text-[oklch(80%_0.2_55)]",
  game: "group-data-[active=game]/hero:text-[oklch(80%_0.2_250)]",
  book: "group-data-[active=book]/hero:text-[oklch(80%_0.2_95)]",
  comic: "group-data-[active=comic]/hero:text-[oklch(80%_0.2_20)]",
};

export function Hero({
  copy,
  backdrop,
  strip,
}: {
  copy: HeroCopy;
  backdrop?: React.ReactNode;
  strip?: React.ReactNode;
}) {
  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      className="group/hero relative md:h-[calc(100svh-57px)] md:min-h-[640px]"
    >
      <div className="relative h-full md:overflow-hidden">
        {backdrop}

        <div className="relative px-4 pb-12 pt-16 md:absolute md:inset-x-0 md:bottom-0 md:px-14 md:pb-20 md:pt-0">
          <div className="relative">
            <span
              className="absolute -left-1 -top-10 rotate-[-8deg] whitespace-nowrap rounded-full bg-accent-lime px-4 py-2 font-display text-sm font-extrabold leading-none text-on-accent-lime md:-left-2"
              style={{ boxShadow: "4px 4px 0 rgba(0,0,0,.4)" }}
            >
              {copy.badge}
            </span>
            <h1
              id="hero-title"
              className="max-w-[17ch] text-balance font-display text-[2.25rem] font-extrabold leading-[1] tracking-[-0.03em] text-text-primary min-[400px]:text-[2.75rem] md:text-[clamp(3.25rem,5.4vw,5.75rem)] md:leading-[0.95]"
            >
              {copy.title.map((part, i) =>
                typeof part === "string" ? (
                  part
                ) : (
                  <span
                    key={i}
                    className={`motion-safe:transition-colors motion-safe:duration-500 ${ACTIVE_CLASS[part.type]}`}
                  >
                    {part.text}
                  </span>
                )
              )}
            </h1>
          </div>
          <p className="mt-6 max-w-[46ch] text-pretty text-lg text-text-secondary md:mt-7 md:text-xl">{copy.sub}</p>
          <div className="mt-8 flex flex-col gap-3 min-[400px]:flex-row min-[400px]:flex-wrap min-[400px]:items-center">
            <KButton variant="primary" size="lg" asChild>
              <Link href="/login?mode=register">{copy.cta}</Link>
            </KButton>
            {copy.demo ? (
              <DemoButton label={copy.demo} locale={copy.locale} className="w-full min-[400px]:w-auto" />
            ) : null}
          </div>
          {strip}
        </div>
      </div>
    </section>
  );
}
