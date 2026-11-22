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
 * - **Tu biblioteca** (F2b): las acciones de biblioteca, lo primero del
 *   cuerpo (en móvil, justo debajo de la franja).
 *
 * «Dónde ver», el tráiler, las adaptaciones y Steam siguen, de momento, en
 * la ficha de hoy (F2c).
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
  /**
   * La franja sigue el tema de la sala, no el de la página (decisión de
   * Víctor, F2a): en libro, manga, cómic y cualquier obra sin apaisada, la
   * sala es un campo `band` en oscuro, y la franja va con él en un solo bloque,
   * separada por un filete de su tinta. En la sala con imagen, la franja sigue
   * el tema de la página.
   */
  bandWithStage?: boolean;
  /** Las acciones de biblioteca, ya montadas (F2b), con su encabezado para el lector. */
  actions?: ReactNode;
  actionsLabel?: string;
}

const SYNOPSIS_ID = "sala-ficha-synopsis";
const FACTS_ID = "sala-ficha-facts";
const CREDITS_ID = "sala-ficha-credits";
const ACTIONS_ID = "sala-ficha-library";

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
          <span aria-current="page" className="line-clamp-2 text-sala-ink">
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
  bandWithStage = false,
  actions,
  actionsLabel,
}: SalaFichaBodyProps) {
  const hasBody = Boolean(synopsis) || credits.length > 0 || Boolean(breadcrumbs) || Boolean(actions);
  return (
    <>
      {facts.length > 0 && (
        <section
          aria-labelledby={FACTS_ID}
          data-sala-ficha-band=""
          // El mismo tema que la sala: un solo bloque de color con ella.
          data-theme={bandWithStage ? "dark" : undefined}
          className={cn(
            "bg-sala-band text-sala-band-ink px-sala-margin",
            bandWithStage ? "pb-8 sm:pb-10" : "py-8 sm:py-10",
            // Cuando llega la paleta, la franja cambia de color sin salto.
            "transition-colors duration-sala-slow ease-sala motion-reduce:transition-none"
          )}
        >
          <h2 id={FACTS_ID} className="sr-only">
            {factsLabel}
          </h2>
          {/* Con la sala del mismo color, un filete de la tinta de la franja (≥ 4,5:1)
              marca dónde acaba el título y empiezan los datos. */}
          <dl
            className={cn(
              "flex flex-wrap gap-x-10 gap-y-5",
              bandWithStage && "border-t-2 border-sala-band-ink pt-6 sm:pt-8"
            )}
          >
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
          {actions && (
            <section aria-labelledby={ACTIONS_ID} data-sala-ficha-actions="" className="mb-12 pt-2">
              <h2 id={ACTIONS_ID} className="sr-only">
                {actionsLabel}
              </h2>
              {actions}
            </section>
          )}
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
                <section
                  aria-labelledby={CREDITS_ID}
                  className={cn(
                    "min-w-0 self-start bg-sala-panel p-6",
                    synopsis ? "lg:col-span-4 lg:col-start-9" : "lg:col-span-5"
                  )}
                >
                  <h2 id={CREDITS_ID} className="sala-type-small mb-4 text-sala-ink">
                    {creditsLabel}
                  </h2>
                  <dl className="grid gap-4">
                    {credits.map(({ key, label, value }) => (
                      <div key={key}>
                        <dt className="sala-type-small text-sala-ink-secondary">{label}</dt>
                        <dd className="sala-type-text [overflow-wrap:anywhere]">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
