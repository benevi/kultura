// ============================================================
// KULTURA — /best (hub de rankings, PÚBLICA) · SEO-7 (D-16)
// Índice de los rankings como páginas del álbum: el campo cian con el titular
// y el criterio, y por cada formato su top 5 en cromos numerados del año más
// reciente con ranking indexable, más los enlaces a todos los años. Lleva
// tarjeta de compartir (la del ranking de películas destacado).
// ============================================================

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AlbumPage } from "@/components/album/AlbumPage";
import { Footer } from "@/components/layout/Footer";
import { BestBreadcrumbs, BestFormatNav, BestHeader, BestSignupBar, BestTabs, BestYearNav } from "@/components/best/BestNav";
import { BestSaveEnhancer } from "@/components/best/BestSave";
import { BestTopRow } from "@/components/best/BestTopRow";
import { BEST_FORMATS, bestYears, getFeaturedRanking, type BestFormat } from "@/lib/best/best-of";
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
  params: Promise<{ locale: string }>;
}

/** Formato cuya tarjeta enseña el hub al compartirlo. */
const CARD_FORMAT: BestFormat = "movie";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "best" });
  // Misma caché que la página. Sin datos, el año en curso (la tarjeta se
  // pinta igual, con los respaldos de color).
  const year = await getFeaturedRanking(CARD_FORMAT, locale).then(
    (f) => f?.year ?? bestYears()[0],
    () => bestYears()[0],
  );
  return bestMetadata({
    locale,
    path: "/best",
    title: t("hub.title"),
    description: t("hub.description"),
    image: { path: rankingCardPath(CARD_FORMAT, year), alt: t(`title.${CARD_FORMAT}`, { year }) },
  });
}

export default async function BestHubPage({ params }: Props) {
  const locale = bestLocale((await params).locale);
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "best" });
  const years = bestYears();
  // Un proveedor caído deja SU sección con un aviso; el resto del hub se pinta
  // (y se vuelve a pedir en la regeneración siguiente).
  const featured = await Promise.all(
    BEST_FORMATS.map((f) => getFeaturedRanking(f, locale).catch(() => "unavailable" as const)),
  );
  const crumbs: Crumb[] = [
    { name: t("breadcrumb.home"), path: "/" },
    { name: t("breadcrumb.rankings"), path: "/best" },
  ];
  const title = t("hub.title");
  const here = localeHref(locale, "/best");
  // La primera fila con portadas lleva el LCP (`fetchpriority=high`).
  const firstWithItems = featured.findIndex((f) => f !== "unavailable" && f !== null);

  return (
    <div className="theme-paper flex min-h-screen flex-col pb-20">
      <BestHeader locale={locale} returnTo={here} />
      <main id="main" className="flex-1">
        <AlbumPage tone="cyan" as="div" className="pb-8 pt-2 md:pb-12 md:pt-4">
          <header className="flex flex-col gap-3 md:gap-4">
            <BestBreadcrumbs locale={locale} crumbs={crumbs} />
            <h1 className="max-w-4xl text-balance font-display text-4xl text-text-primary md:text-6xl">{title}</h1>
            <p className="max-w-2xl text-base text-text-primary">{t("hub.intro")}</p>
            <BestTabs>
              <BestFormatNav locale={locale} hrefFor={(f) => `/best/${f}`} />
            </BestTabs>
          </header>
        </AlbumPage>

        <AlbumPage tone="white" as="div" className="py-8 md:py-12">
          <div className="flex flex-col divide-y-2 divide-surface-border">
            {BEST_FORMATS.map((format, i) => {
              const result = featured[i];
              const unavailable = result === "unavailable";
              const f = unavailable ? null : result;
              return (
                <section key={format} aria-labelledby={`hub-${format}`} className="flex flex-col gap-4 py-8 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h2 id={`hub-${format}`} className="font-display text-2xl text-text-primary md:text-4xl">
                      <a
                        href={localeHref(locale, `/best/${format}`)}
                        className="rounded-lg hover:underline hover:decoration-2 hover:underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                      >
                        {t(`formatHub.title.${format}`)}
                      </a>
                    </h2>
                    {f ? (
                      <a
                        href={localeHref(locale, `/best/${format}/${f.year}`)}
                        className="inline-flex min-h-11 items-center rounded-lg text-sm font-bold text-text-primary underline decoration-2 underline-offset-4 hover:decoration-accent-pink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
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
                      first={i === firstWithItems}
                    />
                  ) : unavailable ? (
                    <p className="text-sm text-text-secondary">{t("hub.unavailable")}</p>
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
