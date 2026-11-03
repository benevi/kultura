// ============================================================
// KULTURA — Navegación de los rankings públicos (DIS-10, SEO-10)
// Cabecera fina, migas, pestañas de formato y de año, «Otros rankings» y la
// barra de alta. Server Components con `<a>` (ver `lib/best/links.ts`: el
// `Link` de next-intl arrastra el JS de la app).
//
// Página impresa del álbum (DISENO.md): elegido = el chip «pegado» en la
// tinta del texto (`bg-text-primary text-surface-base`), nunca rosa ni
// amarillo de relleno. El rosa es solo la barra de alta: UNA acción por
// pantalla, así que la cabecera de los rankings no repite «Registrarse».
// ============================================================

import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/layout/Logo";
import { KButton } from "@/components/ui/KButton";
import { BEST_FORMATS, type BestFormat } from "@/lib/best/best-of";
import { localeHref, loginHref, signUpHref } from "@/lib/best/links";
import type { Crumb } from "@/lib/best/seo";

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

const CHIP = `inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-sm font-bold transition-colors duration-fast ${FOCUS}`;
const CHIP_ON = "bg-text-primary text-surface-base";
const CHIP_OFF = "bg-surface-elevated text-text-primary hover:bg-album-yellow hover:text-album-ink";

const TEXT_LINK = `rounded-lg underline decoration-2 underline-offset-4 transition-colors duration-fast hover:decoration-accent-pink ${FOCUS}`;

/**
 * Cabecera de los rankings: el logotipo y el botón de entrar (con vuelta a esta
 * página). Mismo alto (56 px), retícula y raya de 2 px que `Header`, en papel.
 */
export async function BestHeader({ locale, returnTo }: { locale: string; returnTo: string }) {
  const t = await getTranslations({ locale, namespace: "auth" });
  return (
    <header className="sticky top-0 z-50 border-b-2 border-surface-border bg-surface-base">
      <div className="page-grid flex h-14 items-center justify-between gap-2">
        <a href={localeHref(locale, "/")} className={`flex min-h-11 shrink-0 items-center rounded-lg ${FOCUS}`}>
          <Logo size={24} />
        </a>
        <KButton variant="secondary" size="sm" asChild>
          <a href={loginHref(locale, returnTo)} rel="nofollow">
            {t("signIn")}
          </a>
        </KButton>
      </div>
    </header>
  );
}

export async function BestBreadcrumbs({ locale, crumbs }: { locale: string; crumbs: Crumb[] }) {
  const t = await getTranslations({ locale, namespace: "best" });
  return (
    <nav aria-label={t("breadcrumb.label")}>
      <ol className="flex flex-wrap items-center gap-x-1 text-sm font-semibold text-text-secondary">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.path} className="flex items-center gap-x-1">
              <a
                href={localeHref(locale, c.path)}
                aria-current={last ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-lg ${last ? "" : "underline decoration-1 underline-offset-4 hover:decoration-2"} ${FOCUS}`}
              >
                {c.name}
              </a>
              {last ? null : <span aria-hidden="true">/</span>}
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
      <ul className="flex gap-2">
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
                className={`${CHIP} tabular-nums ${active ? CHIP_ON : CHIP_OFF}`}
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
 * Pestañas de formato y de año en una sola fila que se desliza en el móvil
 * (dos filas se comían la primera pantalla y el podio quedaba debajo).
 */
export function BestTabs({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
      {children}
    </div>
  );
}

/** Raya vertical entre los formatos y los años dentro de `BestTabs`. */
export function BestTabsRule() {
  return <span aria-hidden="true" className="mx-1 h-7 w-0.5 shrink-0 bg-surface-border" />;
}

/**
 * Los rankings hermanos (Espinof): los otros formatos del mismo año y el
 * mismo formato en otros años. Enlaces con el título entero, buenos para el
 * lector y para el buscador.
 */
export async function BestSiblings({
  locale,
  format,
  year,
  years,
}: {
  locale: string;
  format: BestFormat;
  year: number;
  years: number[];
}) {
  const t = await getTranslations({ locale, namespace: "best" });
  const links = [
    ...BEST_FORMATS.filter((f) => f !== format).map((f) => ({ path: `/best/${f}/${year}`, text: t(`title.${f}`, { year }) })),
    ...years.filter((y) => y !== year).map((y) => ({ path: `/best/${format}/${y}`, text: t(`title.${format}`, { year: y }) })),
  ];
  return (
    <nav aria-labelledby="best-siblings" className="flex flex-col gap-4">
      <h2 id="best-siblings" className="font-display text-2xl text-text-primary">
        {t("siblings")}
      </h2>
      <ul className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
        {links.map((l) => (
          <li key={l.path}>
            <a href={localeHref(locale, l.path)} className={`inline-flex min-h-11 items-center text-base font-semibold text-text-primary ${TEXT_LINK}`}>
              {l.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * La ÚNICA acción de color de la página: «Guarda los que te faltan · gratis»,
 * alta con vuelta a este ranking. Barra fija abajo (zona del pulgar, con el
 * margen del iPhone), sin modal. Con la cuenta abierta la esconde `BestSaveEnhancer`.
 */
export async function BestSignupBar({ locale, returnTo }: { locale: string; returnTo: string }) {
  const t = await getTranslations({ locale, namespace: "best" });
  return (
    <section
      data-best-signup=""
      aria-label={t("cta.title")}
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-album-navy bg-surface-base pb-[env(safe-area-inset-bottom)]"
    >
      <div className="page-grid flex items-center gap-4 py-2.5">
        <KButton variant="primary" size="lg" className="w-full sm:w-auto" asChild>
          <a href={signUpHref(locale, returnTo)} rel="nofollow">
            {t("cta.action")}
          </a>
        </KButton>
        <a
          href={loginHref(locale, returnTo)}
          rel="nofollow"
          className={`hidden min-h-11 items-center text-sm font-semibold text-text-primary sm:inline-flex ${TEXT_LINK}`}
        >
          {t("cta.login")}
        </a>
      </div>
    </section>
  );
}
