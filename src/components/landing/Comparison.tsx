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
// Tokens y radios de DISENO.md: superficie `--surface-default`, radio 22,
// KULTURA con la pegatina lime y su fila/columna en `--surface-elevated`.
// ============================================================

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

const STICKER = "inline-block rotate-[-4deg] rounded-full bg-accent-lime px-3 py-1.5 font-display text-sm font-extrabold leading-none text-on-accent-lime";
const STICKER_SHADOW = { boxShadow: "4px 4px 0 oklch(0% 0 0 / 0.4)" };

function Mark({ on, yes, no }: { on: boolean; yes: string; no: string }) {
  return on ? (
    <>
      <span
        aria-hidden="true"
        className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-accent-positive text-on-accent-positive"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M9.6 17.2 4.8 12.4a1.5 1.5 0 1 1 2.1-2.1l2.7 2.7 7.5-7.5a1.5 1.5 0 1 1 2.1 2.1l-9.6 9.6Z" />
        </svg>
      </span>
      <span className="sr-only">{yes}</span>
    </>
  ) : (
    <>
      <span aria-hidden="true" className="block text-center text-text-tertiary">
        –
      </span>
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
  return (
    <section aria-labelledby="compare-title" className="page-grid pb-20 md:pb-28">
      <h2
        id="compare-title"
        className="font-display text-4xl md:text-6xl font-extrabold tracking-[-0.03em] text-text-primary mb-4 max-w-[18ch] text-balance"
      >
        {heading}
      </h2>
      <p className="text-text-secondary text-base mb-12 max-w-[56ch]">{sub}</p>

      {/* Escritorio: matriz app × formato. */}
      <div data-testid="compare-matrix" className="hidden overflow-hidden rounded-bento bg-surface-default md:block">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th scope="col" rowSpan={2} className="px-5 py-3 text-left align-bottom font-bold text-text-secondary">
                {appHeader}
              </th>
              <th scope="colgroup" colSpan={FORMATS.length} className="px-2 pt-4 pb-1 text-center text-xs font-bold uppercase tracking-wide text-text-tertiary">
                {formatsHeader}
              </th>
            </tr>
            <tr>
              {FORMATS.map((f) => (
                <th key={f} scope="col" className={cn(cell, "text-center font-bold text-text-primary")}>
                  {formats[f]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-surface-elevated">
              <th scope="row" className="whitespace-nowrap border-t border-surface-border px-5 py-3 text-left">
                <span className={STICKER} style={STICKER_SHADOW}>
                  KULTURA
                </span>
              </th>
              {FORMATS.map((f) => (
                <td key={f} className={cn(cell, "border-t border-surface-border")}>
                  <Mark on yes={yes} no={no} />
                </td>
              ))}
            </tr>
            {COMPARED_APPS.map((app) => (
              <tr key={app.name}>
                <th
                  scope="row"
                  className="whitespace-nowrap border-t border-surface-border px-5 py-3 text-left font-display text-base font-extrabold text-text-primary"
                >
                  {app.name}
                </th>
                {FORMATS.map((f) => (
                  <td key={f} className={cn(cell, "border-t border-surface-border")}>
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
      <div data-testid="compare-by-format" className="overflow-hidden rounded-bento bg-surface-default md:hidden">
        <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
          <colgroup>
            <col className="w-[30%]" />
            <col className="w-[24%]" />
            <col className="w-[46%]" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="px-3 py-3 text-left text-sm font-bold text-text-secondary">
                {formatHeader}
              </th>
              <th scope="col" className="bg-surface-elevated px-1 py-3 text-center">
                <span
                  className="inline-block rotate-[-4deg] rounded-full bg-accent-lime px-1.5 py-1 font-display text-xs font-extrabold leading-none text-on-accent-lime"
                  style={STICKER_SHADOW}
                >
                  KULTURA
                </span>
              </th>
              <th scope="col" className="px-3 py-3 text-left text-sm font-bold leading-tight text-text-secondary">
                {specialistHeader}
              </th>
            </tr>
          </thead>
          <tbody>
            {FORMATS.map((f) => {
              const apps = specialistsFor(f);
              return (
                <tr key={f}>
                  <th scope="row" className="border-t border-surface-border px-3 py-3 text-left font-display text-base font-extrabold text-text-primary">
                    {formats[f]}
                  </th>
                  <td className="border-t border-surface-border bg-surface-elevated px-1 py-3 align-middle">
                    <Mark on yes={yes} no={no} />
                  </td>
                  <td className="border-t border-surface-border px-3 py-3 align-middle">
                    {apps.length > 0 ? (
                      <span className="flex flex-wrap gap-1.5">
                        {apps.map((name) => (
                          <span key={name} className="rounded-full bg-surface-elevated px-2.5 py-1 text-xs font-bold text-text-primary">
                            {name}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-sm leading-tight text-text-tertiary">{none}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-text-tertiary max-w-[70ch]">{note}</p>
    </section>
  );
}
