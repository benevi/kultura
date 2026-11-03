// ============================================================
// KULTURA — /best/[format] (hub de un formato, PÚBLICA) · SEO-7 (D-16)
// "Los mejores animes por año": el criterio del formato en el campo cian y,
// por cada año publicado, su top 5 en cromos numerados con enlace al ranking
// completo. Los años sin ranking indexable salen igualmente (con su enlace)
// pero sin portadas. Tarjeta de compartir: la del año destacado.
// ============================================================

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AlbumPage } from "@/components/album/AlbumPage";
import { Footer } from "@/components/layout/Footer";
import { BestBreadcrumbs, BestFormatNav, BestHeader, BestSignupBar, BestTabs } from "@/components/best/BestNav";
import { BestSaveEnhancer } from "@/components/best/BestSave";
import { BestTopRow } from "@/components/best/BestTopRow";
import {
  BEST_FIRST_YEAR,
  bestYears,
  getBestRanking,
  getFeaturedRanking,
  isBestFormat,
  isIndexableRanking,
} from "@/lib/best/best-of";
import { bestLocale, bestMetadata, hubJsonLd, rankingCardPath, serializeJsonLd, type Crumb } from "@/lib/best/seo";
import { localeHref } from "@/lib/best/links";

export const revalidate = 86400;

// D-02: HTML cacheado en el CDN. Ningún ranking se pinta en el build (no
// depende de los proveedores): cada URL se genera en su primera visita y se
// regenera cada 24 h (`dynamicParams` sigue en su valor por defecto, true).
export function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ locale: string; format: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, format } = await params;
  if (!isBestFormat(format)) return {};
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "best" });
  // La tarjeta del año destacado del formato (misma caché que la página).
  const year = await getFeaturedRanking(format, locale).then(
    (f) => f?.year ?? bestYears()[0],
    () => bestYears()[0],
  );
  return bestMetadata({
    locale,
    path: `/best/${format}`,
    title: t(`formatHub.title.${format}`),
    description: t(`formatHub.description.${format}`, { first: BEST_FIRST_YEAR }),
    image: { path: rankingCardPath(format, year), alt: t(`title.${format}`, { year }) },
  });
}

export default async function BestFormatHubPage({ params }: Props) {
  const { locale: rawLocale, format } = await params;
  if (!isBestFormat(format)) notFound();
  const locale = bestLocale(rawLocale);
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "best" });
  const years = bestYears();
  // Un año cuyo proveedor falla muestra un aviso; los demás se pintan.
  const rankings = await Promise.all(years.map((y) => getBestRanking(format, y, locale).catch(() => null)));
  const title = t(`formatHub.title.${format}`);
  const crumbs: Crumb[] = [
    { name: t("breadcrumb.home"), path: "/" },
    { name: t("breadcrumb.rankings"), path: "/best" },
    { name: t(`chip.${format}`), path: `/best/${format}` },
  ];

  const here = localeHref(locale, `/best/${format}`);
  const firstShown = rankings.findIndex((r) => r !== null && isIndexableRanking(r.items.length));

  return (
    <div className="theme-paper flex min-h-screen flex-col pb-20">
      <BestHeader locale={locale} returnTo={here} />
      <main id="main" className="flex-1">
        <AlbumPage tone="cyan" as="div" className="pb-8 pt-2 md:pb-12 md:pt-4">
          <header className="flex flex-col gap-3 md:gap-4">
            <BestBreadcrumbs locale={locale} crumbs={crumbs} />
            <h1 className="max-w-4xl text-balance font-display text-4xl text-text-primary md:text-6xl">{title}</h1>
            <p className="max-w-2xl text-base text-text-primary">
              {t(`formatHub.description.${format}`, { first: BEST_FIRST_YEAR })} {t("formatHub.intro")}
            </p>
            <p className="max-w-2xl text-sm text-text-primary">{t(`formatHub.criteria.${format}`)}</p>
            <BestTabs>
              <BestFormatNav locale={locale} current={format} hrefFor={(f) => `/best/${f}`} />
            </BestTabs>
          </header>
        </AlbumPage>

        <AlbumPage tone="white" as="div" className="py-8 md:py-12">
          <div className="flex flex-col divide-y-2 divide-surface-border">
            {years.map((year, i) => {
              const ranking = rankings[i];
              const show = ranking !== null && isIndexableRanking(ranking.items.length);
              const yearTitle = t(`title.${format}`, { year });
              return (
                <section key={year} aria-labelledby={`year-${year}`} className="flex flex-col gap-4 py-8 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h2 id={`year-${year}`} className="font-display text-2xl text-text-primary md:text-4xl">
                      <a
                        href={localeHref(locale, `/best/${format}/${year}`)}
                        className="rounded-lg hover:underline hover:decoration-2 hover:underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                      >
                        {yearTitle}
                      </a>
                    </h2>
                    <a
                      href={localeHref(locale, `/best/${format}/${year}`)}
                      className="inline-flex min-h-11 items-center rounded-lg text-sm font-bold text-text-primary underline decoration-2 underline-offset-4 hover:decoration-accent-pink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                    >
                      {t("hub.seeRanking", { year })}
                    </a>
                  </div>
                  {show ? (
                    <BestTopRow items={ranking.items} locale={locale} label={t("hub.top", { year })} first={i === firstShown} />
                  ) : ranking ? (
                    <p className="text-sm text-text-secondary">{t("provisional", { count: ranking.items.length })}</p>
                  ) : (
                    <p className="text-sm text-text-secondary">{t("hub.unavailable")}</p>
                  )}
                </section>
              );
            })}
          </div>
        </AlbumPage>
      </main>
      <Footer />
      <BestSignupBar locale={locale} returnTo={here} />
      <BestSaveEnhancer locale={locale} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            hubJsonLd({
              locale,
              path: `/best/${format}`,
              title,
              description: t(`formatHub.description.${format}`, { first: BEST_FIRST_YEAR }),
              crumbs,
              links: years.map((year) => ({ name: t(`title.${format}`, { year }), path: `/best/${format}/${year}` })),
            }),
          ),
        }}
      />
    </div>
  );
}
