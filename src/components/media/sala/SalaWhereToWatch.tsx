import { useLocale, useTranslations } from "next-intl";
import { SalaLink } from "@/components/sala/SalaLink";
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
 *   (`providerLinkLabel`) y una flecha lo marca a la vista.
 * - **El nombre de la plataforma se ve**, no solo su logo.
 * - **La cita de JustWatch va siempre** (TMDB la exige, PRO-2): texto y logo
 *   con enlace, sin ocultarse ni encogerse.
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
    items: g.items.map((p) => ({ ...p, href: safeTmdbHref(p.url ?? link) })),
  }));
  if (groups.length === 0) return null;
  const allLinked = groups.every((g) => g.items.every((p) => p.href));

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
          "-mx-sala-margin flex gap-10 overflow-x-auto overscroll-x-contain px-sala-margin pb-4 pt-1",
          "scroll-px-sala-margin [scrollbar-width:thin]",
          !allLinked && "sala-focused:sala-focus"
        )}
      >
        {groups.map((group) => (
          <div key={group.type} className="shrink-0">
            <h3 className="sala-type-small mb-3 text-sala-ink-secondary">{t(`watchType.${group.type}`)}</h3>
            <ul role="list" className="flex list-none gap-4">
              {group.items.map((p) => {
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
                    <span className="sala-type-small line-clamp-2 w-full text-center [overflow-wrap:anywhere]">
                      {p.name}
                      {p.href && (
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 12 12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="square"
                          className="ml-[0.25em] inline-block h-[0.7em] w-[0.7em] align-baseline"
                        >
                          <path d="M3 9 9 3M4 3h5v5" />
                        </svg>
                      )}
                    </span>
                  </>
                );
                return (
                  <li key={p.name} className="w-20 shrink-0">
                    {p.href ? (
                      <a
                        href={p.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t("providerLinkLabel", { name: p.name })}
                        className={cn(
                          "flex min-h-sala-target flex-col items-center gap-2 p-1 text-sala-ink",
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
