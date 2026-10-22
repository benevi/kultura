// ============================================================
// KULTURA — "La alternativa a Letterboxd, Trakt y MyAnimeList" (SEO-9, CRE-10)
//
// Comparativa HONESTA: no se puntúa a nadie ni se afirman cosas que cambian
// (precios, anuncios, funciones). Solo en qué se centra cada app, que es la
// razón real para elegir KULTURA: hoy hacen falta cinco apps para lo que aquí
// está en una. Tabla de dos columnas (app y en qué se centra), no una matriz
// de 8 columnas: se lee igual a 320 px. Chips de formato con el patrón de
// DISENO.md (activo = color vivo + texto on-color; inactivo = `--surface-2`).
// ============================================================

import { cn } from "@/lib/utils/index";
import type { MediaType } from "@/types/media";

/** App de referencia y los formatos en los que se centra. */
export const COMPARED_APPS: ReadonlyArray<{ name: string; formats: MediaType[] }> = [
  { name: "Letterboxd", formats: ["movie"] },
  { name: "Trakt", formats: ["movie", "tv"] },
  { name: "MyAnimeList", formats: ["anime", "manga"] },
  { name: "Goodreads", formats: ["book"] },
  { name: "Backloggd", formats: ["game"] },
];

const ALL_FORMATS: MediaType[] = ["movie", "tv", "anime", "manga", "game", "book", "comic"];

/** Chip activo por formato: acentos de la paleta con su texto on-color. */
const CHIP: Record<MediaType, string> = {
  movie: "bg-accent-pink text-on-accent-pink",
  tv: "bg-accent-purple text-on-accent-purple",
  anime: "bg-accent-lime text-on-accent-lime",
  manga: "bg-accent-orange text-on-accent-orange",
  game: "bg-accent-blue text-on-accent-blue",
  book: "bg-accent-yellow text-on-accent-yellow",
  comic: "bg-accent-pink text-on-accent-pink",
};

export interface ComparisonProps {
  heading: string;
  sub: string;
  /** Nombre de cada formato, traducido. */
  formats: Record<MediaType, string>;
  /** Etiqueta de la fila de KULTURA. */
  kulturaLabel: string;
  /** Nombre de las columnas para lectores de pantalla. */
  appHeader: string;
  formatsHeader: string;
  /** Aviso de marcas. */
  note: string;
}

export function Comparison({ heading, sub, formats, kulturaLabel, appHeader, formatsHeader, note }: ComparisonProps) {
  const label = (list: MediaType[]) => list.map((f) => formats[f]);
  return (
    <section aria-labelledby="compare-title" className="px-4 md:px-8 pb-20 md:pb-28 max-w-6xl mx-auto">
      <h2
        id="compare-title"
        className="font-display text-4xl md:text-6xl font-extrabold tracking-[-0.03em] text-text-primary mb-4 max-w-[18ch] text-balance"
      >
        {heading}
      </h2>
      <p className="text-text-secondary text-base mb-12 max-w-[56ch]">{sub}</p>

      <table className="w-full border-separate border-spacing-y-2.5">
        <thead className="sr-only">
          <tr>
            <th scope="col">{appHeader}</th>
            <th scope="col">{formatsHeader}</th>
          </tr>
        </thead>
        <tbody>
          {COMPARED_APPS.map((app) => (
            <tr key={app.name}>
              <th
                scope="row"
                className="w-[38%] rounded-l-20 bg-surface-default py-4 pl-5 pr-3 text-left align-middle font-display text-base font-extrabold text-text-primary sm:w-1/4 sm:text-lg"
              >
                {app.name}
              </th>
              <td className="rounded-r-20 bg-surface-default py-4 pl-2 pr-5 align-middle">
                <span className="flex flex-wrap gap-1.5">
                  {label(app.formats).map((name) => (
                    <span key={name} className="rounded-full bg-surface-elevated px-3 py-1 text-[13px] font-bold text-text-primary">
                      {name}
                    </span>
                  ))}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* KULTURA: los siete formatos juntos. Card plana con la pegatina lime
          colgante (DISENO.md) y cada formato en su color. */}
      <div className="relative mt-8 rounded-bento bg-surface-default p-7 pt-9">
        <span
          className="absolute -left-2 -top-3.5 rotate-[-8deg] rounded-full bg-accent-lime px-3.5 py-2 font-display text-sm font-extrabold leading-none text-on-accent-lime"
          style={{ boxShadow: "4px 4px 0 rgba(0,0,0,.4)" }}
        >
          KULTURA
        </span>
        <p className="mb-4 font-display text-2xl font-extrabold tracking-tight text-text-primary text-balance">{kulturaLabel}</p>
        <ul className="flex flex-wrap gap-2">
          {ALL_FORMATS.map((f) => (
            <li key={f} className={cn("rounded-full px-3.5 py-1.5 text-sm font-bold", CHIP[f])}>
              {formats[f]}
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-4 text-xs text-text-tertiary max-w-[70ch]">{note}</p>
    </section>
  );
}
