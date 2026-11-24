import { useLocale, useTranslations } from "next-intl";
import { SalaLink } from "@/components/sala/SalaLink";
import { groupProviderVariants } from "@/lib/media/provider-groups";
import { cn } from "@/lib/utils/index";
import type { StreamingProvider } from "@/types/media";
import { groupProviders, JUSTWATCH_LOGO_URL, justWatchUrl, safeTmdbHref } from "../StreamingProviders";
import { SalaFichaSection } from "./SalaFichaSection";
import { SalaScrollRow } from "./SalaScrollRow";

const HEADING_ID = "sala-ficha-watch";

/**
 * «Dónde ver» en la ficha con «Sala» (F2c): las plataformas en una fila que
 * se desliza, agrupadas por modalidad (suscripción, alquiler, compra), con los
 * mismos datos y enlaces que la ficha de hoy (`StreamingProviders`).
 *
 * - **La fila se desliza sin trampas.** Cada plataforma es un enlace: con el
 *   tabulador se recorren en orden y la fila lleva a la vista, entera, la
 *   que tiene el foco (`SalaScrollRow`, con `scroll-padding`: el anillo no
 *   queda cortado en el borde). La barra de desplazamiento se ve. Si alguna plataforma no tiene
 *   enlace, la fila misma entra en el orden del teclado para poder moverla
 *   con las flechas. No hay que salir de ella con nada especial.
 * - **Cada enlace dice que abre otra web**: su nombre accesible lo avisa
 *   (`salaProviderLinkLabel`, con la modalidad: «Apple TV, alquiler») y una
 *   flecha en la esquina lo marca a la vista.
 * - **El nombre de la plataforma se ve**, no solo su logo, y entero: se parte
 *   y la tarjeta crece.
 * - **La cita de JustWatch va siempre** (TMDB la exige, PRO-2): texto y logo
 *   con enlace, sin ocultarse ni encogerse.
 *
 * - **Por debajo de `sm` no hay fila**: los grupos y las plataformas se
 *   parten en varias líneas y no se corta nada (F6). Desde `sm`, la fila.
 * - **Variantes de un servicio juntas** (F6, decisión de Víctor): «Amazon
 *   Prime Video» y «… with Ads» van en una tarjeta con el nombre y el logo
 *   literales de la principal; las demás se abren con «+N» (`<details>`),
 *   cada una con su nombre literal y su enlace (`provider-groups.ts`).
 *
 * Server Component: todo sale en el HTML. El único JS es el de la fila.
 */
export function SalaWhereToWatch({
  providers,
  title,
  link,
}: {
  providers: StreamingProvider[];
  title: string;
  /** Página "dónde ver" de TMDB del título (`tmdbWatchLink`). */
  link?: string;
}) {
  const t = useTranslations("media_detail");
  const locale = useLocale();
  const groups = groupProviders(providers).map((g) => ({
    ...g,
    items: groupProviderVariants(g.items.map((p) => ({ ...p, href: safeTmdbHref(p.url ?? link) }))),
  }));
  if (groups.length === 0) return null;
  const allLinked = groups.every((g) => g.items.every(({ main, variants }) => main.href && variants.every((v) => v.href)));

  return (
    <SalaFichaSection id={HEADING_ID} heading={title} data-sala-ficha-watch="">
      {/* La fila llega a los bordes de la pantalla (sale del margen) para que
          se vea que sigue; el primer y el último elemento respetan el margen.
          Sin `scroll-snap`: devolvía la fila al inicio del grupo cuando el
          navegador la movía para enseñar el enlace con el foco, que se quedaba
          cortado. */}
      <SalaScrollRow
        data-sala-watch-row=""
        // Sin enlaces que recorrer, la fila tiene que poder recibir el foco
        // para moverla con las flechas (WCAG 2.1.1), y con nombre.
        {...(allLinked ? {} : { tabIndex: 0, role: "group", "aria-labelledby": HEADING_ID })}
        className={cn(
          // Sale hasta el borde de la retícula (`page-grid`: 16 px, 32 px desde md).
          // Por debajo de `sm`, en varias líneas (F6); desde `sm`, la fila que se desliza.
          "flex flex-wrap gap-x-10 gap-y-6 pb-4 pt-1",
          "sm:-mx-4 sm:flex-nowrap sm:overflow-x-auto sm:overscroll-x-contain sm:px-4 md:-mx-8 md:px-8",
          "sm:scroll-px-4 md:scroll-px-8 [scrollbar-width:thin]",
          !allLinked && "sala-focused:sala-focus"
        )}
      >
        {groups.map((group) => (
          <div key={group.type} className="min-w-0 sm:shrink-0">
            <h3 className="sala-type-small mb-3 text-sala-ink-secondary">{t(`watchType.${group.type}`)}</h3>
            <ul role="list" className="flex list-none flex-wrap gap-4 sm:flex-nowrap">
              {group.items.map(({ main: p, variants }) => {
                const tile = (
                  <>
                    {/* img nativo intencionado: logos pequeños, muchos providers */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.logoPath}
                      alt=""
                      width={56}
                      height={56}
                      loading="lazy"
                      className="h-14 w-14 object-contain"
                    />
                    {/* Sin recorte: un nombre largo se parte y la tarjeta crece
                        (WCAG 1.4.12). La flecha de «abre otra web» va en la
                        esquina, fuera del texto, para que no se pierda. */}
                    <span className="sala-type-small w-full text-center [overflow-wrap:anywhere]">{p.name}</span>
                    {p.href && (
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="square"
                        className="absolute right-0.5 top-0.5 h-2.5 w-2.5"
                      >
                        <path d="M3 9 9 3M4 3h5v5" />
                      </svg>
                    )}
                  </>
                );
                return (
                  <li key={p.name} className="w-20 shrink-0" data-sala-watch-service="">
                    {p.href ? (
                      <a
                        href={p.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t("salaProviderLinkLabel", { name: p.name, type: group.type })}
                        className={cn(
                          "relative flex min-h-sala-target flex-col items-center gap-2 p-1 text-sala-ink",
                          "transition-colors duration-sala-fast ease-sala motion-reduce:transition-none",
                          "[&>span]:sala-hover:underline [&>span]:sala-hover:decoration-2 [&>span]:sala-hover:underline-offset-4",
                          "sala-focused:sala-focus"
                        )}
                      >
                        {tile}
                      </a>
                    ) : (
                      <div className="flex flex-col items-center gap-2 p-1 text-sala-ink">
                        {/* Sin enlace, el nombre visible es el texto: el logo es adorno. */}
                        {tile}
                      </div>
                    )}
                    {variants.length > 0 && (
                      <details data-sala-watch-variants="" className="mt-1 sala-type-small">
                        <summary
                          aria-label={t("salaProviderVariantsLabel", { name: p.name, count: variants.length })}
                          className={cn(
                            "flex min-h-sala-target cursor-pointer list-none items-center justify-center text-sala-ink-secondary",
                            "underline underline-offset-4 sala-hover:text-sala-ink sala-focused:sala-focus",
                            "[&::-webkit-details-marker]:hidden"
                          )}
                        >
                          {t("salaProviderVariants", { count: variants.length })}
                        </summary>
                        <ul role="list" className="mt-1 grid list-none gap-1">
                          {variants.map((v) => (
                            <li key={v.name} className="[overflow-wrap:anywhere]">
                              {v.href ? (
                                <a
                                  href={v.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={t("salaProviderLinkLabel", { name: v.name, type: group.type })}
                                  className="inline-flex min-h-sala-target items-center text-sala-ink underline underline-offset-4 sala-focused:sala-focus"
                                >
                                  {v.name}
                                </a>
                              ) : (
                                <span className="inline-flex min-h-sala-target items-center text-sala-ink">{v.name}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </SalaScrollRow>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 sala-type-small text-sala-ink-secondary">
        <span>{t("justwatchAttribution")}</span>
        <SalaLink
          href={justWatchUrl(locale)}
          variant="standalone"
          aria-label={t("justwatchLinkLabel")}
          // El logo es el nombre: el subrayado del enlace va bajo él.
          className="[&>span]:inline-flex [&>span]:items-center"
        >
          {/* El logo (amarillo) va tal cual sobre una pastilla negra: sobre un
              fondo claro de la obra no se leería (como el de Google sobre blanco). */}
          <span className="inline-flex bg-black px-2 py-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={JUSTWATCH_LOGO_URL} alt="JustWatch" width={86} height={13} className="h-[13px] w-auto" loading="lazy" />
          </span>
        </SalaLink>
      </p>
    </SalaFichaSection>
  );
}
