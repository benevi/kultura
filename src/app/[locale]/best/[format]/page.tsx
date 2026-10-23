// ============================================================
// KULTURA — /best/[format] (hub de un formato, PÚBLICA) · SEO-7 (D-16)
// "Los mejores animes por año": el criterio del formato y, por cada año
// publicado, su top 5 con enlace al ranking completo. Los años sin ranking
// indexable salen igualmente (con su enlace) pero sin pósteres.
// ============================================================

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { BestBreadcrumbs, BestCta, BestFormatNav } from "@/components/best/BestNav";
import { BestTopRow } from "@/components/best/BestTopRow";
import {
  BEST_FIRST_YEAR,
  bestYears,
  getBestRanking,
  isBestFormat,
  isIndexableRanking,
} from "@/lib/best/best-of";
import { bestLocale, bestMetadata, hubJsonLd, serializeJsonLd, type Crumb } from "@/lib/best/seo";
import { localeHref } from "@/lib/best/links";

export const revalidate = 86400;

interface Props {
  params: Promise<{ locale: string; format: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, format } = await params;
  if (!isBestFormat(format)) return {};
  const t = await getTranslations({ locale, namespace: "best" });
  return bestMetadata({
    locale,
    path: `/best/${format}`,
    title: t(`formatHub.title.${format}`),
    description: t(`formatHub.description.${format}`, { first: BEST_FIRST_YEAR }),
  });
}

export default async function BestFormatHubPage({ params }: Props) {
  const { locale: rawLocale, format } = await params;
  if (!isBestFormat(format)) notFound();
  const locale = bestLocale(rawLocale);
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

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main" className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-10 flex flex-col gap-10 md:gap-12">
        <header className="flex flex-col gap-4">
          <BestBreadcrumbs locale={locale} crumbs={crumbs} />
          <h1 className="font-display text-3xl md:text-[42px] font-bold leading-tight text-text-primary">{title}</h1>
          <p className="text-[15px] text-text-secondary max-w-prose">
            {t(`formatHub.description.${format}`, { first: BEST_FIRST_YEAR })} {t("formatHub.intro")}
          </p>
          <p className="text-[13px] text-text-tertiary max-w-prose">
            {t(`formatHub.criteria.${format}`)}
          </p>
          <BestFormatNav locale={locale} current={format} hrefFor={(f) => `/best/${f}`} />
        </header>

        {years.map((year, i) => {
          const ranking = rankings[i];
          const show = ranking !== null && isIndexableRanking(ranking.items.length);
          const yearTitle = t(`title.${format}`, { year });
          return (
            <section key={year} aria-labelledby={`year-${year}`} className="flex flex-col gap-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id={`year-${year}`} className="font-display text-2xl md:text-[28px] font-extrabold text-text-primary">
                  <a
                    href={localeHref(locale, `/best/${format}/${year}`)}
                    className="hover:text-accent-pink transition-colors focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring rounded-[4px]"
                  >
                    {yearTitle}
                  </a>
                </h2>
                <a
                  href={localeHref(locale, `/best/${format}/${year}`)}
                  className="inline-flex min-h-11 items-center text-[14px] font-bold text-accent-pink underline underline-offset-4 focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring rounded-[4px]"
                >
                  {t("hub.seeRanking", { year })}
                </a>
              </div>
              {show ? (
                <BestTopRow items={ranking.items} locale={locale} label={t("hub.top", { year })} />
              ) : ranking ? (
                <p className="text-[14px] text-text-tertiary">
                  {t("provisional", { count: ranking.items.length })}
                </p>
              ) : (
                <p className="text-[14px] text-text-tertiary">{t("hub.unavailable")}</p>
              )}
            </section>
          );
        })}

        <BestCta locale={locale} year={years[0]} returnTo={localeHref(locale, `/best/${format}`)} />
      </main>
      <Footer />
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
