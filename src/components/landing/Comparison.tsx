// ============================================================
// KULTURA — "La alternativa a Letterboxd, Trakt y MyAnimeList" (SEO-9, CRE-10)
//
// Matriz: KULTURA frente a las apps de referencia, con los 7 formatos y las
// funciones básicas que todas comparten. Comparativa PRUDENTE: de cada app se
// marca solo el formato en el que se centra (lo que cualquiera puede comprobar
// en su web) y las funciones que tienen sin discusión (puntuar, listas,
// seguir a amigos). Nada de precios, anuncios ni funciones que cambian. La
// nota al pie lo explica.
//
// A 320 px la tabla se desplaza en horizontal DENTRO de su caja (región con
// foco, para teclado) con la columna de la app fija; la página no se desborda.
// Tokens y radios de DISENO.md: superficie `--surface-default`, radio 22,
// fila de KULTURA en `--surface-elevated` con la pegatina lime.
// ============================================================

import { cn } from "@/lib/utils/index";
import type { MediaType } from "@/types/media";

export type CompareFeature = "rate" | "lists" | "friends";

const FORMATS: MediaType[] = ["movie", "tv", "anime", "manga", "game", "book", "comic"];
const FEATURES: CompareFeature[] = ["rate", "lists", "friends"];

/** Filas: formatos en los que se centra cada app y funciones básicas. */
export const COMPARED_APPS: ReadonlyArray<{ name: string; formats: MediaType[]; features: CompareFeature[] }> = [
  { name: "KULTURA", formats: FORMATS, features: FEATURES },
  { name: "Letterboxd", formats: ["movie"], features: FEATURES },
  { name: "Trakt", formats: ["movie", "tv"], features: FEATURES },
  { name: "MyAnimeList", formats: ["anime", "manga"], features: FEATURES },
  { name: "Goodreads", formats: ["book"], features: FEATURES },
  { name: "Backloggd", formats: ["game"], features: FEATURES },
];

export interface ComparisonProps {
  heading: string;
  sub: string;
  /** Nombre de cada formato, traducido. */
  formats: Record<MediaType, string>;
  /** Nombre de cada función, traducido. */
  features: Record<CompareFeature, string>;
  /** Cabeceras de grupo y de la columna de apps. */
  appHeader: string;
  formatsHeader: string;
  featuresHeader: string;
  /** Texto para lectores de pantalla en cada celda. */
  yes: string;
  no: string;
  /** Qué se marca y aviso de marcas. */
  note: string;
  /** Nombre de la caja desplazable (distinto del de la sección: axe landmark-unique). */
  tableLabel: string;
}

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
  features,
  appHeader,
  formatsHeader,
  featuresHeader,
  yes,
  no,
  note,
  tableLabel,
}: ComparisonProps) {
  const cell = "px-2 py-3 align-middle";
  return (
    <section aria-labelledby="compare-title" className="px-4 md:px-8 pb-20 md:pb-28 max-w-6xl mx-auto">
      <h2
        id="compare-title"
        className="font-display text-4xl md:text-6xl font-extrabold tracking-[-0.03em] text-text-primary mb-4 max-w-[18ch] text-balance"
      >
        {heading}
      </h2>
      <p className="text-text-secondary text-base mb-12 max-w-[56ch]">{sub}</p>

      <div
        role="region"
        aria-label={tableLabel}
        tabIndex={0}
        // `relative`: los textos `sr-only` son absolutos; sin un ancestro
        // posicionado dentro de la caja, escapaban del recorte y la PÁGINA se
        // desbordaba 374 px a 320 de ancho.
        className="relative overflow-x-auto rounded-bento bg-surface-default focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        <table className="w-full min-w-[46rem] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th scope="col" rowSpan={2} className="sticky left-0 z-10 bg-surface-default px-5 py-3 text-left align-bottom font-bold text-text-secondary">
                {appHeader}
              </th>
              <th scope="colgroup" colSpan={FORMATS.length} className="px-2 pt-4 pb-1 text-center text-xs font-bold uppercase tracking-wide text-text-tertiary">
                {formatsHeader}
              </th>
              <th scope="colgroup" colSpan={FEATURES.length} className="border-l border-surface-border px-2 pt-4 pb-1 text-center text-xs font-bold uppercase tracking-wide text-text-tertiary">
                {featuresHeader}
              </th>
            </tr>
            <tr>
              {FORMATS.map((f) => (
                <th key={f} scope="col" className={cn(cell, "text-center font-bold text-text-primary")}>
                  {formats[f]}
                </th>
              ))}
              {FEATURES.map((f, i) => (
                <th key={f} scope="col" className={cn(cell, "text-center font-bold text-text-primary", i === 0 && "border-l border-surface-border")}>
                  {features[f]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARED_APPS.map((app, row) => {
              const ours = row === 0;
              const bg = ours ? "bg-surface-elevated" : "bg-surface-default";
              return (
                <tr key={app.name} className={bg}>
                  <th
                    scope="row"
                    className={cn(
                      "sticky left-0 z-10 whitespace-nowrap border-t border-surface-border px-5 py-3 text-left font-display text-base font-extrabold text-text-primary",
                      bg
                    )}
                  >
                    {ours ? (
                      <span
                        className="inline-block rotate-[-4deg] rounded-full bg-accent-lime px-3 py-1.5 text-sm leading-none text-on-accent-lime"
                        style={{ boxShadow: "4px 4px 0 rgba(0,0,0,.4)" }}
                      >
                        {app.name}
                      </span>
                    ) : (
                      app.name
                    )}
                  </th>
                  {FORMATS.map((f) => (
                    <td key={f} className={cn(cell, "border-t border-surface-border")}>
                      <Mark on={app.formats.includes(f)} yes={yes} no={no} />
                    </td>
                  ))}
                  {FEATURES.map((f, i) => (
                    <td key={f} className={cn(cell, "border-t border-surface-border", i === 0 && "border-l")}>
                      <Mark on={app.features.includes(f)} yes={yes} no={no} />
                    </td>
                  ))}
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
