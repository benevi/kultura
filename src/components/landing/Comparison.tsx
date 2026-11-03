// ============================================================
// KULTURA — "La alternativa a Letterboxd, Trakt y MyAnimeList" (SEO-9, CRE-10)
//
// Comparativa PRUDENTE: de cada app de referencia se marca solo el formato en
// el que se centra (lo que cualquiera puede comprobar en su web). Nada de
// precios, anuncios ni funciones que cambian; la nota al pie lo explica. Las
// funciones comunes (puntuar, listas, amigos) no se comparan: todas las tienen
// y la tabla no distinguía nada.
//
// Dos lecturas de los MISMOS datos:
//   - ≥ 768 px: matriz app × formato (6 filas × 7 columnas), sin desplazarse.
//   - < 768 px: la tabla traspuesta, una fila por formato con KULTURA ✓ y la
//     app especializada que lo cubre. Tres columnas: se lee entera a 320 px
//     sin desplazamiento horizontal.
// Página blanca del álbum con rayas de tinta de 2 px; KULTURA en su fila (o
// columna) sobre el campo amarillo. La marca va en texto («Sí» / «No» para
// el lector), nunca solo por color.
// ============================================================

import { AlbumPage } from "@/components/album/AlbumPage";
import { cn } from "@/lib/utils/index";
import type { MediaType } from "@/types/media";

const FORMATS: MediaType[] = ["movie", "tv", "anime", "manga", "game", "book", "comic"];

/** Apps de referencia y el formato (o formatos) en que se centra cada una. */
export const COMPARED_APPS: ReadonlyArray<{ name: string; formats: MediaType[] }> = [
  { name: "Letterboxd", formats: ["movie"] },
  { name: "Trakt", formats: ["movie", "tv"] },
  { name: "MyAnimeList", formats: ["anime", "manga"] },
  { name: "Goodreads", formats: ["book"] },
  { name: "Backloggd", formats: ["game"] },
];

/** Apps especializadas en un formato (lectura móvil). */
export function specialistsFor(format: MediaType): string[] {
  return COMPARED_APPS.filter((a) => a.formats.includes(format)).map((a) => a.name);
}

export interface ComparisonProps {
  heading: string;
  sub: string;
  /** Nombre de cada formato, traducido. */
  formats: Record<MediaType, string>;
  /** Cabeceras: columna de apps y grupo de formatos (escritorio). */
  appHeader: string;
  formatsHeader: string;
  /** Cabeceras de la tabla traspuesta (móvil). */
  formatHeader: string;
  specialistHeader: string;
  /** Texto para lectores de pantalla en cada celda. */
  yes: string;
  no: string;
  /** Formato sin app especializada en la lista. */
  none: string;
  /** Qué se marca y aviso de marcas. */
  note: string;
}

/** KULTURA en su fila: el campo amarillo del álbum, la marca en tinta. */
const KULTURA = "font-display text-2xl text-text-primary";

function Mark({ on, yes, no }: { on: boolean; yes: string; no: string }) {
  return on ? (
    <>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mx-auto h-5 w-5 text-text-primary">
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      </svg>
      <span className="sr-only">{yes}</span>
    </>
  ) : (
    <>
      <span aria-hidden="true" className="mx-auto block h-0.5 w-3 rounded-full bg-text-tertiary" />
      <span className="sr-only">{no}</span>
    </>
  );
}

export function Comparison({
  heading,
  sub,
  formats,
  appHeader,
  formatsHeader,
  formatHeader,
  specialistHeader,
  yes,
  no,
  none,
  note,
}: ComparisonProps) {
  const cell = "px-2 py-3 align-middle";
  const rule = "border-t-2 border-surface-border";
  return (
    <AlbumPage aria-labelledby="compare-title" className="py-16 md:py-24">
      <h2
        id="compare-title"
        className="mb-4 max-w-[22ch] text-balance font-display text-3xl text-text-primary md:text-4xl"
      >
        {heading}
      </h2>
      <p className="mb-10 max-w-[60ch] text-base text-text-secondary">{sub}</p>

      {/* Escritorio: matriz app × formato. */}
      <div data-testid="compare-matrix" className="hidden overflow-hidden rounded-2xl border-2 border-album-navy md:block">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th scope="col" rowSpan={2} className="px-5 py-3 text-left align-bottom font-semibold text-text-secondary">
                {appHeader}
              </th>
              <th scope="colgroup" colSpan={FORMATS.length} className="px-2 pb-1 pt-4 text-center text-xs font-semibold text-text-secondary">
                {formatsHeader}
              </th>
            </tr>
            <tr>
              {FORMATS.map((f) => (
                <th key={f} scope="col" className={cn(cell, "text-center font-semibold text-text-primary")}>
                  {formats[f]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-album-yellow">
              <th scope="row" className={cn("whitespace-nowrap px-5 py-2 text-left", rule, KULTURA)}>
                KULTURA
              </th>
              {FORMATS.map((f) => (
                <td key={f} className={cn(cell, rule)}>
                  <Mark on yes={yes} no={no} />
                </td>
              ))}
            </tr>
            {COMPARED_APPS.map((app) => (
              <tr key={app.name}>
                <th scope="row" className={cn("whitespace-nowrap px-5 py-3 text-left text-base font-semibold text-text-primary", rule)}>
                  {app.name}
                </th>
                {FORMATS.map((f) => (
                  <td key={f} className={cn(cell, rule)}>
                    <Mark on={app.formats.includes(f)} yes={yes} no={no} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Móvil: la misma información traspuesta, una fila por formato.
          Anchos fijos (30/24/46 %): a 320 px las tres columnas caben enteras. */}
      <div data-testid="compare-by-format" className="overflow-hidden rounded-2xl border-2 border-album-navy md:hidden">
        <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
          <colgroup>
            <col className="w-[30%]" />
            <col className="w-[24%]" />
            <col className="w-[46%]" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="px-3 py-3 text-left text-sm font-semibold text-text-secondary">
                {formatHeader}
              </th>
              <th scope="col" className="bg-album-yellow px-1 py-3 text-center text-sm font-semibold text-album-navy">
                KULTURA
              </th>
              <th scope="col" className="px-3 py-3 text-left text-sm font-semibold leading-tight text-text-secondary">
                {specialistHeader}
              </th>
            </tr>
          </thead>
          <tbody>
            {FORMATS.map((f) => {
              const apps = specialistsFor(f);
              return (
                <tr key={f}>
                  <th scope="row" className={cn("px-3 py-3 text-left text-base font-semibold text-text-primary", rule)}>
                    {formats[f]}
                  </th>
                  <td className={cn("bg-album-yellow px-1 py-3 align-middle", rule)}>
                    <Mark on yes={yes} no={no} />
                  </td>
                  <td className={cn("px-3 py-3 align-middle", rule)}>
                    {apps.length > 0 ? (
                      <span className="flex flex-wrap gap-1.5">
                        {apps.map((name) => (
                          <span key={name} className="rounded-full bg-surface-elevated px-2.5 py-1 text-xs font-semibold text-text-primary">
                            {name}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-sm leading-tight text-text-secondary">{none}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 max-w-[70ch] text-xs text-text-secondary">{note}</p>
    </AlbumPage>
  );
}
