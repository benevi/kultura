// ============================================================
// KULTURA — Página izquierda del álbum: «Lo mejor de {año}»
//
// Huecos numerados YA llenos con portadas reales de los rankings del año
// (los primeros de cine, series y anime, alternando). Cada cromo enlaza a su
// ficha pública. Sin datos (fallback del Suspense o proveedores caídos), los
// mismos huecos vacíos: la página nunca depende de un proveedor.
// ============================================================

import { Slot } from "@/components/album/Slot";
import { LandingCromo } from "@/components/landing/LandingCromo";
import { ALBUM_PAGE_SIZE, type AlbumCromo } from "@/lib/landing/album";
import { isFoil } from "@/lib/design/album";

export interface BestPageProps {
  heading: string;
  /** «Ver los rankings» → /best. */
  linkLabel: string;
  basePath: string;
  items: AlbumCromo[];
}

const SIZES = "(min-width: 768px) 112px, 22vw";

export function BestPage({ heading, linkLabel, basePath, items }: BestPageProps) {
  return (
    <div>
      <div className="mb-4 flex min-h-20 items-end justify-between gap-4 md:min-h-24">
        <h2 id="best-title" className="font-display text-3xl text-text-primary md:text-4xl">
          {heading}
        </h2>
        <a
          href={`${basePath}/best`}
          className="mb-1 inline-flex min-h-11 shrink-0 items-center rounded-lg text-sm font-semibold text-text-primary underline underline-offset-4 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          {linkLabel}
        </a>
      </div>
      <ol aria-labelledby="best-title" className="grid grid-cols-4 gap-3 md:max-w-[30rem]">
        {Array.from({ length: ALBUM_PAGE_SIZE }, (_, i) => {
          const it = items[i];
          return (
            <li key={it?.id ?? `hueco-${i}`}>
              {it ? (
                <a
                  href={`${basePath}${it.path}`}
                  className="group block rounded-cromo focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  <Slot
                    number={i + 1}
                    title={it.title}
                    band={
                      <span aria-hidden="true" className="block h-4 truncate text-xs font-semibold text-text-primary">
                        {it.title}
                      </span>
                    }
                  >
                    <LandingCromo
                      title={it.title}
                      seed={it.id}
                      poster={it.poster}
                      sizes={SIZES}
                      priority={i === 0}
                      foil={isFoil(it.rating)}
                    />
                  </Slot>
                </a>
              ) : (
                <Slot number={i + 1} title="" band={<span aria-hidden="true" className="block h-4" />} />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
