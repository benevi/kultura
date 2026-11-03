// ============================================================
// KULTURA — Primera pantalla de la portada: el álbum abierto
//
// Un solo objeto visto una vez: la banda cian de la tapa con el titular y la
// solapa (buscador que funciona + «Crear mi cuenta gratis», la única acción
// rosa, y «Ver la demo»), y debajo el pliego: dos páginas en un lomo.
// Izquierda, «Lo mejor de {año}» llena con portadas reales de los rankings;
// derecha, «Te faltan», huecos con el título impreso que el sobre llena.
//
// El titular, la solapa y las dos páginas (aunque sea vacías) son HTML del
// primer pintado; las portadas entran por `<Suspense>` y la escena 3D, si el
// equipo puede, después y en un rato libre (`MissingPage`).
// ============================================================

import { AlbumPage } from "@/components/album/AlbumPage";
import { Slot } from "@/components/album/Slot";
import { DemoButton } from "@/components/landing/DemoButton";
import { FlapSearch, type FlapSearchLabels } from "@/components/landing/FlapSearch";
import { Sobre } from "@/components/landing/Sobre";
import { KButton } from "@/components/ui/KButton";
import { ALBUM_PAGE_SIZE } from "@/lib/landing/album";

export interface AlbumHeroCopy {
  title: string;
  sub: string;
  cta: string;
  /** «Ver la demo» (E-DEMO): sin cuenta demo configurada no se pinta. */
  demo?: string;
  locale: string;
  /** Nombre accesible del pliego. */
  region: string;
}

export function AlbumHero({
  copy,
  search,
  left,
  right,
}: {
  copy: AlbumHeroCopy;
  search: FlapSearchLabels;
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <section id="hero" aria-labelledby="hero-title">
      <AlbumPage tone="cyan" as="div" className="pb-8 pt-8 md:pb-10 md:pt-12">
        <div className="grid gap-6 md:grid-cols-12 md:items-end md:gap-8">
          <div className="md:col-span-6 lg:col-span-7">
            <h1
              id="hero-title"
              className="max-w-[18ch] text-balance font-display text-2xl leading-[1.05] text-text-primary min-[360px]:text-3xl sm:text-4xl lg:text-6xl"
            >
              {copy.title}
            </h1>
            <p className="mt-4 max-w-[46ch] text-pretty text-base text-text-primary md:mt-5 md:text-lg">{copy.sub}</p>
          </div>
          {/* La solapa del álbum: papel blanco con su raya de tinta. */}
          <div className="theme-paper rounded-2xl border-2 border-album-navy p-4 md:col-span-6 md:p-5 lg:col-span-5">
            <FlapSearch locale={copy.locale} labels={search} />
            <div className="mt-4 flex flex-col gap-3 border-t-2 border-dashed border-surface-border pt-4 min-[400px]:flex-row min-[400px]:flex-wrap min-[400px]:items-center">
              <KButton variant="primary" size="lg" asChild>
                <a href={`/${copy.locale}/login?mode=register`}>{copy.cta}</a>
              </KButton>
              {copy.demo ? (
                <DemoButton label={copy.demo} locale={copy.locale} className="w-full min-[400px]:w-auto" />
              ) : null}
            </div>
          </div>
        </div>
      </AlbumPage>
      <AlbumPage as="section" aria-label={copy.region} left={left} right={right} className="py-8 md:py-10" />
    </section>
  );
}

/** Página derecha mientras llega la muestra (o si no llega): huecos sin título. */
export function MissingPagePlaceholder({ heading, startNumber }: { heading: string; startNumber: number }) {
  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 id="missing-title" className="font-display text-3xl text-text-primary md:text-4xl">
          {heading}
        </h2>
        <Sobre torn={false} />
      </div>
      <ol aria-labelledby="missing-title" className="grid grid-cols-4 gap-3 md:max-w-[30rem]">
        {Array.from({ length: ALBUM_PAGE_SIZE }, (_, i) => (
          <li key={i}>
            <Slot number={startNumber + i} title="" band={<span aria-hidden="true" className="block h-4" />} />
          </li>
        ))}
      </ol>
    </div>
  );
}
