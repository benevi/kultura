// ============================================================
// KULTURA — Los siete formatos como secciones del álbum (página blanca)
//
// La página de índice del álbum: una fila por sección, con la pestaña del
// color del formato JUNTO a su nombre (el color es un dato, nunca va solo),
// lo que se apunta en ella (lo que de verdad guarda el progreso de cada
// formato) y tres portadas reales de esa sección cuando las hay.
// ============================================================

import { AlbumPage } from "@/components/album/AlbumPage";
import { LandingCromo } from "@/components/landing/LandingCromo";
import { FORMATS, FORMAT_COLOR } from "@/lib/design/album";
import type { AlbumCromo } from "@/lib/landing/album";
import type { MediaType } from "@/types/media";

export interface FormatSectionsProps {
  heading: string;
  names: Record<MediaType, string>;
  tracks: Record<MediaType, string>;
  covers: AlbumCromo[];
}

export function FormatSections({ heading, names, tracks, covers }: FormatSectionsProps) {
  return (
    <AlbumPage aria-labelledby="sections-title" className="py-16 md:py-24">
      <h2 id="sections-title" className="mb-8 text-balance font-display text-3xl text-text-primary md:mb-12 md:text-4xl">
        {heading}
      </h2>
      <ul className="border-b-2 border-surface-border">
        {FORMATS.map((type) => {
          const own = covers.filter((c) => c.type === type).slice(0, 3);
          return (
            <li
              key={type}
              data-format={type}
              className="grid items-center gap-x-6 gap-y-3 border-t-2 border-surface-border py-5 md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto]"
            >
              <h3 className="flex items-center gap-3 font-display text-2xl text-text-primary">
                <span aria-hidden="true" className="h-7 w-2.5 shrink-0 rounded-cromo" style={{ backgroundColor: FORMAT_COLOR[type] }} />
                {names[type]}
              </h3>
              <p className="text-base text-text-secondary">{tracks[type]}</p>
              {own.length > 0 ? (
                <div aria-hidden="true" className="flex gap-2">
                  {own.map((it) => (
                    <div key={it.id} className="w-12 md:w-14">
                      <LandingCromo title={it.title} seed={it.id} poster={it.poster} sizes="56px" still />
                    </div>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </AlbumPage>
  );
}
