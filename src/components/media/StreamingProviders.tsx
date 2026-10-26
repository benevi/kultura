// ============================================================
// KULTURA — StreamingProviders ("Dónde ver")
// Plataformas donde está el título en el país del idioma, agrupadas por
// modalidad: suscripción, alquiler y compra (PRO-6; antes solo se enseñaba la
// primera que hubiera). Sin repetidos por nombre dentro de cada grupo.
// Server Component (sin "use client").
//
// ATRIBUCIÓN OBLIGATORIA (PRO-2): estos datos los sirve TMDB pero son de
// JustWatch, y TMDB exige citarlo ("you must attribute the source of the data
// as JustWatch… we will revoke access to the API"). Por eso la sección SIEMPRE
// lleva el logo de JustWatch con enlace, y no se puede pintar sin él.
// TMDB tampoco da enlaces directos a cada plataforma: pide enlazar a su página
// "dónde ver" (`link`, ver `tmdbWatchLink`), así que cada logo enlaza ahí
// cuando la ficha la pasa.
// ============================================================

import { useLocale, useTranslations } from "next-intl";
import type { StreamingProvider } from "@/types/media";

/**
 * Logo oficial de JustWatch (amarillo: se lee en claro y oscuro), servido
 * desde `public/` y no desde justwatch.com: una URL de terceros puede cambiar
 * o caerse y dejar la cita sin logo, y además filtraría la visita.
 */
export const JUSTWATCH_LOGO_URL = "/brands/justwatch.webp";

/** Portada de JustWatch del país que corresponde a la oferta mostrada. */
export function justWatchUrl(locale: string): string {
  return locale === "en" ? "https://www.justwatch.com/us" : "https://www.justwatch.com/es";
}

/**
 * Solo se enlaza a TMDB por https (el `link` llega de una respuesta externa).
 * El host tiene que ser `themoviedb.org` o un subdominio suyo: un
 * `endsWith("themoviedb.org")` sin punto aceptaría `evilthemoviedb.org`.
 */
export function safeTmdbHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  try {
    const url = new URL(href);
    const host = url.hostname.toLowerCase();
    const isTmdb = host === "themoviedb.org" || host.endsWith(".themoviedb.org");
    return url.protocol === "https:" && isTmdb ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

interface StreamingProvidersProps {
  providers: StreamingProvider[];
  title: string;
  /** Página "dónde ver" de TMDB del título (`tmdbWatchLink`). */
  link?: string;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink";

/** Modalidades en el orden en que se pintan (claves de `media_detail.watchType`). */
const GROUPS = ["flatrate", "free", "ads", "rent", "buy"] as const;

export function StreamingProviders({
  providers,
  title,
  link,
}: StreamingProvidersProps) {
  const t = useTranslations("media_detail");
  const locale = useLocale();

  const groups = GROUPS.map((type) => ({
    type,
    items: providers
      .filter((p) => p.type === type)
      .filter((p, i, arr) => arr.findIndex((x) => x.name === p.name) === i),
  })).filter((g) => g.items.length > 0);

  if (groups.length === 0) return null;

  return (
    <section>
      <h2 className="font-display text-xl font-bold text-text-primary mb-3">{title}</h2>
      {/* Grupos en línea (con salto si no caben), no uno por fila. */}
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        {groups.map((group) => (
          <div key={group.type}>
            <h3 className="text-xs font-bold uppercase tracking-wide text-text-tertiary mb-2">
              {t(`watchType.${group.type}`)}
            </h3>
            <ul className="flex flex-wrap gap-3">
              {group.items.map((p) => {
                const href = safeTmdbHref(p.url ?? link);
                const tile = (
                  <>
                    {/* img nativo intencionado: logos pequeños, muchos providers */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.logoPath}
                      alt={p.name}
                      width={48}
                      height={48}
                      loading="lazy"
                      className="w-12 h-12 rounded-lg object-contain bg-surface-elevated"
                    />
                    {/* El nombre ya lo da el `alt`: no se lee dos veces. */}
                    <span aria-hidden="true" className="max-w-[72px] truncate text-xs text-text-tertiary">
                      {p.name}
                    </span>
                  </>
                );
                return (
                  <li key={p.name}>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t("providerLinkLabel", { name: p.name })}
                        className={`flex flex-col items-center gap-1 rounded-lg hover:opacity-80 transition-opacity ${focusRing}`}
                      >
                        {tile}
                      </a>
                    ) : (
                      <div className="flex flex-col items-center gap-1">{tile}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-text-tertiary">
        <span>{t("justwatchAttribution")}</span>
        <a
          href={justWatchUrl(locale)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("justwatchLinkLabel")}
          className={`inline-flex items-center min-h-11 rounded-lg hover:opacity-80 transition-opacity ${focusRing}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={JUSTWATCH_LOGO_URL}
            alt="JustWatch"
            width={86}
            height={13}
            className="h-[13px] w-auto"
            loading="lazy"
          />
        </a>
      </p>
    </section>
  );
}
