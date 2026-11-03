// ============================================================
// KULTURA — Cierre de la portada: la contratapa del álbum (CRE-10)
//
// La portada termina como empieza: la banda cian con el titular y, en la
// solapa blanca, los mismos dos botones («Crear mi cuenta gratis», la única
// acción rosa, y «Ver la demo»). Quien llega al final no tiene que volver
// arriba. El sobre, ya abierto: el siguiente lo abres tú.
// ============================================================

import { AlbumPage } from "@/components/album/AlbumPage";
import { DemoButton } from "@/components/landing/DemoButton";
import { Sobre } from "@/components/landing/Sobre";
import { KButton } from "@/components/ui/KButton";

export interface FinalCtaProps {
  title: string;
  sub: string;
  cta: string;
  demo?: string;
  locale: string;
}

export function FinalCta({ title, sub, cta, demo, locale }: FinalCtaProps) {
  return (
    <AlbumPage tone="cyan" aria-labelledby="final-title" className="py-16 md:py-24">
      <div className="grid gap-8 md:grid-cols-12 md:items-center">
        <div className="md:col-span-7">
          <h2 id="final-title" className="max-w-[18ch] text-balance font-display text-3xl text-text-primary md:text-4xl">
            {title}
          </h2>
          <p className="mt-4 max-w-[44ch] text-lg text-text-primary">{sub}</p>
        </div>
        <div className="theme-paper flex items-center gap-5 rounded-2xl border-2 border-album-navy p-5 md:col-span-5">
          <Sobre torn className="hidden min-[400px]:block" />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <KButton variant="primary" size="lg" asChild>
              <a href={`/${locale}/login?mode=register`}>{cta}</a>
            </KButton>
            {demo ? <DemoButton label={demo} locale={locale} className="w-full" /> : null}
          </div>
        </div>
      </div>
    </AlbumPage>
  );
}
