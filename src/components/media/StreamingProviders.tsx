// ============================================================
// KULTURA — StreamingProviders
// Lista de plataformas donde está disponible el título.
// Prioriza flatrate > rent > buy. Elimina duplicados por nombre.
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

/** Logo oficial de JustWatch, servido por JustWatch (amarillo: se lee en claro y oscuro). */
export const JUSTWATCH_LOGO_URL =
  "https://www.justwatch.com/appassets/img/logo/JustWatch-logo-large.webp";

/** Portada de JustWatch del país que corresponde a la oferta mostrada. */
export function justWatchUrl(locale: string): string {
  return locale === "en" ? "https://www.justwatch.com/us" : "https://www.justwatch.com/es";
}

/** Solo se enlaza a TMDB por https (el `link` llega de una respuesta externa). */
function safeTmdbHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  try {
    const url = new URL(href);
    return url.protocol === "https:" && url.hostname.endsWith("themoviedb.org")
      ? url.toString()
      : undefined;
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

export function StreamingProviders({
  providers,
  title,
  link,
}: StreamingProvidersProps) {
  const t = useTranslations("media_detail");
  const locale = useLocale();

  const flatrate = providers.filter((p) => p.type === "flatrate");
  const toShow =
    flatrate.length > 0
      ? flatrate
      : providers.filter((p) => p.type === "rent").length > 0
        ? providers.filter((p) => p.type === "rent")
        : providers.filter((p) => p.type === "buy");

  // Dedup por nombre
  const unique = toShow.filter(
    (p, i, arr) => arr.findIndex((x) => x.name === p.name) === i
  );

  if (unique.length === 0) return null;

  return (
    <div>
      <h2 className="font-display text-2xl tracking-wide text-text mb-3">
        {title}
      </h2>
      <ul className="flex flex-wrap gap-3">
        {unique.map((p) => {
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
                className="w-12 h-12 rounded-lg object-contain bg-surface2"
              />
              <span className="text-xs text-muted">{p.name}</span>
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
      <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted">
        <span>{t("justwatchAttribution")}</span>
        <a
          href={justWatchUrl(locale)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("justwatchLinkLabel")}
          className={`inline-flex items-center rounded hover:opacity-80 transition-opacity ${focusRing}`}
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
    </div>
  );
}
