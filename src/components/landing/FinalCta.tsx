// ============================================================
// KULTURA — Cierre de la landing (CRE-10, DIS-15)
//
// La landing termina con la misma promesa y los mismos dos botones que el
// hero: quien llega al final no tiene que volver arriba. Card "feature" grande
// de F0 (gradiente de un matiz + acento radial arriba a la izquierda) en
// púrpura, para que el botón rosa destaque.
// ============================================================

import { Link } from "@/i18n/navigation";
import { KButton } from "@/components/ui/KButton";
import { DemoButton } from "@/components/landing/DemoButton";

const BACKGROUND =
  "radial-gradient(120% 100% at 20% 10%, oklch(68% 0.2 300 / 0.58), transparent 55%), linear-gradient(160deg, oklch(42% 0.15 300), oklch(22% 0.06 300))";

export interface FinalCtaProps {
  title: string;
  sub: string;
  cta: string;
  demo?: string;
  locale: string;
}

export function FinalCta({ title, sub, cta, demo, locale }: FinalCtaProps) {
  return (
    <section aria-labelledby="final-title" className="px-4 md:px-8 pb-20 md:pb-28 max-w-6xl mx-auto">
      <div className="rounded-bento-xl px-6 py-14 text-center md:px-14 md:py-20" style={{ background: BACKGROUND }}>
        <h2
          id="final-title"
          className="mx-auto max-w-[16ch] text-balance font-display text-4xl font-extrabold leading-[0.95] tracking-[-0.03em] text-text-primary md:text-6xl"
        >
          {title}
        </h2>
        <p className="mx-auto mt-6 max-w-[44ch] text-lg text-text-primary">{sub}</p>
        <div className="mt-9 flex flex-col items-stretch justify-center gap-3 min-[400px]:flex-row min-[400px]:flex-wrap min-[400px]:items-center">
          <KButton variant="primary" size="lg" asChild>
            <Link href="/login?mode=register">{cta}</Link>
          </KButton>
          {demo ? (
            <DemoButton
              label={demo}
              locale={locale}
              className="w-full min-[400px]:w-auto"
              // Sobre el púrpura, el borde `--surface-border` y el texto
              // secundario no se distinguían: borde y texto claros.
              buttonClassName="border-text-secondary text-text-primary"
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
