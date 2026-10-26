// ============================================================
// KULTURA — Navegación de los rankings públicos (DIS-10, SEO-10)
// Migas, selector de formato (con el actual marcado) y selector de año
// aparte, más el bloque de alta. Server Components con `<a>` (ver
// `lib/best/links.ts`: el `Link` de next-intl arrastra el JS de la app).
// ============================================================

import { getTranslations } from "next-intl/server";
import { BEST_FORMATS, type BestFormat } from "@/lib/best/best-of";
import { localeHref, loginHref, signUpHref } from "@/lib/best/links";
import type { Crumb } from "@/lib/best/seo";

const FOCUS =
  "focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

const CHIP = `inline-flex min-h-11 items-center rounded-full px-4 text-meta font-bold transition-colors ${FOCUS}`;
/** Chip relleno: activo en lima (estado, DISENO.md), inactivo en `--surface-2`. */
const CHIP_ON = "bg-accent-lime text-on-accent-lime";
const CHIP_OFF = "bg-surface-elevated text-text-primary hover:text-accent-pink";
/** Chip "outline" para los años: el activo se rellena del mismo lima. */
const YEAR_ON = "border-2 border-accent-lime bg-accent-lime text-on-accent-lime";
const YEAR_OFF = "border-2 border-stroke text-text-primary hover:text-accent-pink";

export async function BestBreadcrumbs({ locale, crumbs }: { locale: string; crumbs: Crumb[] }) {
  const t = await getTranslations({ locale, namespace: "best" });
  return (
    <nav aria-label={t("breadcrumb.label")}>
      <ol className="flex flex-wrap items-center gap-x-1 text-meta font-bold text-text-tertiary">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.path} className="flex items-center gap-x-1">
              {last ? (
                <a href={localeHref(locale, c.path)} aria-current="page" className={`py-3 text-text-secondary ${FOCUS} rounded-lg`}>
                  {c.name}
                </a>
              ) : (
                <>
                  <a href={localeHref(locale, c.path)} className={`py-3 hover:text-accent-pink transition-colors ${FOCUS} rounded-lg`}>
                    {c.name}
                  </a>
                  <span aria-hidden="true">/</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Los cuatro formatos; el actual con `aria-current="page"`. */
export async function BestFormatNav({
  locale,
  current,
  hrefFor,
}: {
  locale: string;
  current?: BestFormat;
  hrefFor: (format: BestFormat) => string;
}) {
  const t = await getTranslations({ locale, namespace: "best" });
  return (
    <nav aria-label={t("nav.format")}>
      <ul className="flex flex-wrap gap-2">
        {BEST_FORMATS.map((f) => {
          const active = f === current;
          return (
            <li key={f}>
              <a
                href={localeHref(locale, hrefFor(f))}
                aria-current={active ? "page" : undefined}
                className={`${CHIP} ${active ? CHIP_ON : CHIP_OFF}`}
              >
                {t(`chip.${f}`)}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export async function BestYearNav({
  locale,
  format,
  years,
  current,
  label,
}: {
  locale: string;
  format: BestFormat;
  years: number[];
  current?: number;
  /** Nombre del `<nav>` si hay varios en la página (un landmark por formato). */
  label?: string;
}) {
  const t = await getTranslations({ locale, namespace: "best" });
  return (
    <nav aria-label={label ?? t("nav.year")}>
      <ul className="flex flex-wrap gap-2">
        {years.map((y) => {
          const active = y === current;
          return (
            <li key={y}>
              <a
                href={localeHref(locale, `/best/${format}/${y}`)}
                aria-current={active ? "page" : undefined}
                className={`${CHIP} ${active ? YEAR_ON : YEAR_OFF}`}
              >
                {y}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * "Guarda los que te faltan" (CRE-11): alta con vuelta a este ranking. Mismo
 * patrón que el bloque de alta del perfil público: card `rounded-bento`, pill
 * primario y secundario.
 */
export async function BestCta({ locale, year, returnTo }: { locale: string; year: number; returnTo: string }) {
  const t = await getTranslations({ locale, namespace: "best" });
  return (
    <section
      aria-labelledby="best-cta-title"
      className="flex flex-col items-start gap-4 rounded-bento bg-surface-default p-6 md:p-8"
    >
      <h2 id="best-cta-title" className="font-display text-2xl font-extrabold text-text-primary">
        {t("cta.title")}
      </h2>
      <p className="max-w-prose text-base text-text-secondary">{t("cta.body", { year })}</p>
      <div className="flex flex-wrap gap-3">
        <a
          href={signUpHref(locale, returnTo)}
          rel="nofollow"
          className="inline-flex h-11 items-center rounded-full bg-accent-pink px-6 text-base font-extrabold text-on-accent-pink transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
        >
          {t("cta.action")}
        </a>
        <a
          href={loginHref(locale, returnTo)}
          rel="nofollow"
          className="inline-flex h-11 items-center rounded-full border-2 border-surface-border px-6 text-base font-bold text-text-secondary transition-all hover:bg-surface-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
        >
          {t("cta.login")}
        </a>
      </div>
    </section>
  );
}
