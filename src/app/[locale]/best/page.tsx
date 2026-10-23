// ============================================================
// KULTURA — /best (hub de rankings, PÚBLICA) · SEO-7 (D-16)
// Índice de los rankings: por cada formato, el top 5 del año más reciente
// con ranking indexable y los enlaces a todos los años. Contenido propio
// (criterio + pósteres con ficha), no una página de enlaces vacía.
// ============================================================

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { BestBreadcrumbs, BestFormatNav, BestYearNav } from "@/components/best/BestNav";
import { BestTopRow } from "@/components/best/BestTopRow";
import { BEST_FORMATS, bestYears, getFeaturedRanking } from "@/lib/best/best-of";
import { bestLocale, bestMetadata, hubJsonLd, serializeJsonLd, type Crumb } from "@/lib/best/seo";
import { localeHref } from "@/lib/best/links";

export const revalidate = 86400;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "best" });
  return bestMetadata({ locale, path: "/best", title: t("hub.title"), description: t("hub.description") });
}

export default async function BestHubPage({ params }: Props) {
  const locale = bestLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "best" });
  const years = bestYears();
  // Un proveedor caído deja SU sección con un aviso; el resto del hub se pinta
  // (la página es dinámica: no hay versión anterior que conservar).
  const featured = await Promise.all(
    BEST_FORMATS.map((f) => getFeaturedRanking(f, locale).catch(() => "unavailable" as const)),
  );
  const crumbs: Crumb[] = [
    { name: t("breadcrumb.home"), path: "/" },
    { name: t("breadcrumb.rankings"), path: "/best" },
  ];
  const title = t("hub.title");

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main" className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-10 flex flex-col gap-10 md:gap-12">
        <header className="flex flex-col gap-4">
          <BestBreadcrumbs locale={locale} crumbs={crumbs} />
          <h1 className="font-display text-3xl md:text-[42px] font-bold leading-tight text-text-primary">{title}</h1>
          <p className="text-[15px] text-text-secondary max-w-prose">{t("hub.intro")}</p>
          <BestFormatNav locale={locale} hrefFor={(f) => `/best/${f}`} />
        </header>

        {BEST_FORMATS.map((format, i) => {
          const result = featured[i];
          const unavailable = result === "unavailable";
          const f = unavailable ? null : result;
          return (
            <section key={format} aria-labelledby={`hub-${format}`} className="flex flex-col gap-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id={`hub-${format}`} className="font-display text-2xl md:text-[28px] font-extrabold text-text-primary">
                  <a href={localeHref(locale, `/best/${format}`)} className="hover:text-accent-pink transition-colors focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring rounded-[4px]">
                    {t(`formatHub.title.${format}`)}
                  </a>
                </h2>
                {f ? (
                  <a
                    href={localeHref(locale, `/best/${format}/${f.year}`)}
                    className="inline-flex min-h-11 items-center text-[14px] font-bold text-accent-pink underline underline-offset-4 focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring rounded-[4px]"
                  >
                    {t("hub.seeRanking", { year: f.year })}
                  </a>
                ) : null}
              </div>
              {f ? (
                <BestTopRow
                  items={f.ranking.items}
                  locale={locale}
                  label={`${t("hub.top", { year: f.year })} · ${t(`chip.${format}`)}`}
                />
              ) : unavailable ? (
                <p className="text-[14px] text-text-tertiary">{t("hub.unavailable")}</p>
              ) : null}
              <BestYearNav
                locale={locale}
                format={format}
                years={years}
                label={`${t("hub.years")} · ${t(`chip.${format}`)}`}
              />
            </section>
          );
        })}
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            hubJsonLd({
              locale,
              path: "/best",
              title,
              description: t("hub.description"),
              crumbs,
              links: BEST_FORMATS.map((f) => ({ name: t(`formatHub.title.${f}`), path: `/best/${f}` })),
            }),
          ),
        }}
      />
    </div>
  );
}
