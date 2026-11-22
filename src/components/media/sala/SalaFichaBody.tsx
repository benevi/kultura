import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/index";

/**
 * El cuerpo de la ficha con «Sala» (fase 8.5, F2a; biblia §1 y §4), debajo de
 * la sala:
 *
 * - **La franja**: un bloque entero con el color más vivo de la imagen y su
 *   tinta (`band` / `band-ink`, ≥ 4,5:1), con los datos de la obra: año,
 *   formato, duración (o episodios, capítulos, páginas), notas y géneros. El
 *   formato va siempre en texto, nunca solo en el color.
 * - **La ficha**, sobre el fondo teñido: la sinopsis y, al lado, el panel (un
 *   paso de tono, sin líneas ni sombras) con los créditos.
 *
 * Server Component: todo sale en el HTML. Pinta con los tokens `--sala-*`, así
 * que vale con los neutros y con la paleta de la obra (el contenedor
 * `sala-work` que la envuelve), en claro y en oscuro, sin saber cuál toca.
 * Las acciones, «Dónde ver», el tráiler, las adaptaciones y Steam siguen,
 * de momento, en la ficha de hoy (F2b y F2c).
 */
export interface SalaFichaFact {
  key: string;
  /** Lo que se ve encima del dato. */
  label: string;
  /** Lo que oye el lector si la etiqueta visible no basta (la fuente de una nota). */
  srLabel?: string;
  value: string;
  /** Detalle del dato, más pequeño («7 notas»). */
  hint?: string;
}

export interface SalaFichaCredit {
  key: string;
  label: string;
  value: string;
}

export interface SalaFichaCrumbs {
  label: string;
  items: { name: string; href: string }[];
  current: string;
}

interface SalaFichaBodyProps {
  factsLabel: string;
  facts: SalaFichaFact[];
  synopsisHeading: string;
  /** La sinopsis ya montada (con su traducción), o `null` si la obra no tiene. */
  synopsis: ReactNode | null;
  creditsLabel: string;
  credits: SalaFichaCredit[];
  breadcrumbs?: SalaFichaCrumbs | null;
}

const SYNOPSIS_ID = "sala-ficha-synopsis";

function SalaFichaBreadcrumbs({ label, items, current }: SalaFichaCrumbs) {
  return (
    <nav aria-label={label} className="mb-6">
      <ol className="flex flex-wrap items-center gap-x-2 sala-type-small text-sala-ink-secondary">
        {items.map((c) => (
          <li key={c.href} className="inline-flex items-center gap-2">
            <Link
              href={c.href}
              className={cn(
                "inline-flex min-h-sala-target items-center underline-offset-4",
                "transition-colors duration-sala-fast ease-sala motion-reduce:transition-none",
                "sala-hover:text-sala-ink sala-hover:underline sala-focused:sala-focus"
              )}
            >
              {c.name}
            </Link>
            <span aria-hidden="true">›</span>
          </li>
        ))}
        <li className="inline-flex min-h-sala-target min-w-0 items-center">
          <span aria-current="page" className="line-clamp-1 text-sala-ink">
            {current}
          </span>
        </li>
      </ol>
    </nav>
  );
}

export function SalaFichaBody({
  factsLabel,
  facts,
  synopsisHeading,
  synopsis,
  creditsLabel,
  credits,
  breadcrumbs,
}: SalaFichaBodyProps) {
  const hasBody = Boolean(synopsis) || credits.length > 0 || Boolean(breadcrumbs);
  return (
    <>
      {facts.length > 0 && (
        <section
          aria-label={factsLabel}
          data-sala-ficha-band=""
          className={cn(
            "bg-sala-band text-sala-band-ink px-sala-margin py-8 sm:py-10",
            // Cuando llega la paleta, la franja cambia de color sin salto.
            "transition-colors duration-sala-slow ease-sala motion-reduce:transition-none"
          )}
        >
          <dl className="flex flex-wrap gap-x-10 gap-y-5">
            {facts.map(({ key, label, srLabel, value, hint }) => (
              <div key={key} data-fact={key} className="min-w-0 max-w-full">
                <dt className="sala-type-small">
                  {srLabel ? (
                    <>
                      <span className="sr-only">{srLabel}</span>
                      <span aria-hidden="true">{label}</span>
                    </>
                  ) : (
                    label
                  )}
                </dt>
                <dd className="sala-type-data [overflow-wrap:anywhere]">
                  {value}
                  {hint && <span className="sala-type-small ml-2 whitespace-nowrap">· {hint}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {hasBody && (
        <div className="px-sala-margin pt-10 pb-14 sm:pt-14">
          {breadcrumbs && <SalaFichaBreadcrumbs {...breadcrumbs} />}
          {(synopsis || credits.length > 0) && (
            <div className="grid gap-12 lg:grid-cols-12 lg:gap-x-12">
              {synopsis && (
                <section aria-labelledby={SYNOPSIS_ID} className="min-w-0 lg:col-span-7">
                  <h2 id={SYNOPSIS_ID} className="sala-type-heading mb-5">
                    {synopsisHeading}
                  </h2>
                  {synopsis}
                </section>
              )}
              {credits.length > 0 && (
                <aside
                  aria-label={creditsLabel}
                  className={cn(
                    "min-w-0 self-start bg-sala-panel p-6",
                    synopsis ? "lg:col-span-4 lg:col-start-9" : "lg:col-span-5"
                  )}
                >
                  <dl className="grid gap-4">
                    {credits.map(({ key, label, value }) => (
                      <div key={key}>
                        <dt className="sala-type-small text-sala-ink-secondary">{label}</dt>
                        <dd className="sala-type-text [overflow-wrap:anywhere]">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </aside>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
