// ============================================================
// KULTURA — /best/[format]/[year] (Server Component, PÚBLICA)
// "Los mejores animes de 2026": contenido indexable sin cuenta. Vive FUERA de
// `(app)` (que redirige a login). Los datos se regeneran cada 24 h; si el
// proveedor falla al regenerar, se conserva la última versión buena.
//
// La página de control del álbum para un año (DISENO.md): campo cian con el
// titular y el podio de tres brillantes en la primera pantalla; en la página
// blanca, el criterio publicado con su fecha y su fuente, «Compartir» y del 4
// al N como cromos numerados con «Guardar»; en la amarilla, los rankings
// hermanos. UNA acción de color: la barra «Guarda los que te faltan ·
// gratis», sin modal. JSON-LD `CollectionPage` + `BreadcrumbList` +
// `ItemList` con `url` e `image`.
// Una lista con menos de BEST_INDEX_MIN_ITEMS títulos se publica con aviso
// pero `noindex` (y fuera del sitemap); vacía, con un estado propio.
// ============================================================

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AlbumPage } from "@/components/album/AlbumPage";
import { Footer } from "@/components/layout/Footer";
import { KButton } from "@/components/ui/KButton";
import { BestPodium, BestRankList } from "@/components/best/BestOfList";
import {
  BestBreadcrumbs,
  BestFormatNav,
  BestHeader,
  BestSiblings,
  BestSignupBar,
  BestTabs,
  BestTabsRule,
  BestYearNav,
} from "@/components/best/BestNav";
import { BestSaveEnhancer } from "@/components/best/BestSave";
import { ShareRanking } from "@/components/best/ShareRanking";
import {
  bestYears,
  getBestRanking,
  isIndexableRanking,
  parseBestParams,
  type BestFormat,
} from "@/lib/best/best-of";
import { bestLocale, bestMetadata, rankingJsonLd, serializeJsonLd, type Crumb } from "@/lib/best/seo";
import { BEST_PROVIDER, localeHref } from "@/lib/best/links";

export const revalidate = 86400;

// D-02: HTML cacheado en el CDN. Ningún ranking se pinta en el build (no
// depende de los proveedores): cada URL se genera en su primera visita y se
// regenera cada 24 h (`dynamicParams` sigue en su valor por defecto, true).
export function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ locale: string; format: string; year: string }>;
}

async function crumbsFor(locale: string, format: BestFormat, year: number): Promise<Crumb[]> {
  const t = await getTranslations({ locale, namespace: "best" });
  return [
    { name: t("breadcrumb.home"), path: "/" },
    { name: t("breadcrumb.rankings"), path: "/best" },
    { name: t(`chip.${format}`), path: `/best/${format}` },
    { name: String(year), path: `/best/${format}/${year}` },
  ];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, format, year } = await params;
  const parsed = parseBestParams(format, year);
  if (!parsed) return {};
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "best" });
  // Misma caché que la página: no repite llamadas. Si falla, la página
  // mostrará el error; los metadatos no deciden nada.
  const count = await getBestRanking(parsed.format, parsed.year, locale).then(
    (r) => r.items.length,
    () => null,
  );
  return bestMetadata({
    locale,
    path: `/best/${parsed.format}/${parsed.year}`,
    title: t(`title.${parsed.format}`, { year: parsed.year }),
    description: t(`description.${parsed.format}`, { year: parsed.year }),
    indexable: count === null || isIndexableRanking(count),
  });
}

export default async function BestOfPage({ params }: Props) {
  const { locale: rawLocale, format, year } = await params;
  const parsed = parseBestParams(format, year);
  if (!parsed) notFound();
  const locale = bestLocale(rawLocale);
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "best" });
  const ranking = await getBestRanking(parsed.format, parsed.year, locale);
  const { items } = ranking;
  const title = t(`title.${parsed.format}`, { year: parsed.year });
  const description = t(`description.${parsed.format}`, { year: parsed.year });
  const path = `/best/${parsed.format}/${parsed.year}`;
  const here = localeHref(locale, path);
  const crumbs = await crumbsFor(locale, parsed.format, parsed.year);
  const years = bestYears();
  const previousYear = years.find((y) => y < parsed.year);
  const updated = new Date(ranking.updatedAt);
  const updatedLabel = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "Europe/Madrid" }).format(updated);
  const provider = BEST_PROVIDER[parsed.format];

  return (
    <div className="theme-paper flex min-h-screen flex-col pb-20">
      <BestHeader locale={locale} returnTo={here} />
      <main id="main" className="flex-1">
        {/* Primera pantalla: el campo cian con el titular y los tres
            brillantes. Lo compartido se ve sin cuenta y sin bajar. */}
        <AlbumPage tone="cyan" as="div" className="pb-10 pt-2 md:pb-14 md:pt-4">
          <header className="flex flex-col gap-3 md:gap-4">
            <BestBreadcrumbs locale={locale} crumbs={crumbs} />
            <h1 className="text-balance font-display text-4xl text-text-primary md:text-6xl">{title}</h1>
            <BestTabs>
              <BestFormatNav locale={locale} current={parsed.format} hrefFor={(f) => `/best/${f}/${parsed.year}`} />
              <BestTabsRule />
              <BestYearNav locale={locale} format={parsed.format} years={years} current={parsed.year} />
            </BestTabs>
          </header>
          {items.length === 0 ? (
            <section className="mt-8 flex max-w-2xl flex-col items-start gap-3">
              <h2 className="font-display text-2xl text-text-primary">{t("empty.title", { year: parsed.year })}</h2>
              <p className="text-base text-text-primary">
                {t("empty.body", { year: parsed.year, noun: t(`noun.${parsed.format}`) })}
              </p>
              {previousYear ? (
                <KButton variant="secondary" size="lg" asChild>
                  <a href={localeHref(locale, `/best/${parsed.format}/${previousYear}`)}>
                    {t("empty.previous", { year: previousYear })}
                  </a>
                </KButton>
              ) : null}
            </section>
          ) : (
            <div className="mt-6 md:mt-10">
              <BestPodium items={items} locale={locale} />
            </div>
          )}
        </AlbumPage>

        {items.length > 0 ? (
          <AlbumPage tone="white" as="div" className="py-8 md:py-12">
            <div className="flex flex-col gap-6 md:gap-8">
              {!isIndexableRanking(items.length) ? (
                <p role="note" className="max-w-2xl rounded-bento border-2 border-surface-border px-4 py-3 text-sm text-text-secondary">
                  {t("provisional", { count: items.length })}
                </p>
              ) : null}
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-10">
                <p className="max-w-2xl text-sm text-text-secondary">
                  {t(`criteria.${parsed.format}`, { year: parsed.year, min: ranking.minVotes ?? 0 })}{" "}
                  {t.rich("updated", {
                    date: updatedLabel,
                    time: (chunks) => <time dateTime={ranking.updatedAt}>{chunks}</time>,
                  })}{" "}
                  {t.rich("source", {
                    provider: provider.name,
                    link: (chunks) => (
                      <a
                        href={provider.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg font-semibold text-text-primary underline decoration-2 underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                      >
                        {chunks}
                      </a>
                    ),
                  })}
                </p>
                <ShareRanking path={here} title={title} />
              </div>
              <BestRankList items={items} locale={locale} />
            </div>
          </AlbumPage>
        ) : null}

        <AlbumPage tone="yellow" as="div" className="py-8 md:py-12">
          <BestSiblings locale={locale} format={parsed.format} year={parsed.year} years={years} />
        </AlbumPage>
      </main>
      <Footer />
      <BestSignupBar locale={locale} returnTo={here} />
      <BestSaveEnhancer locale={locale} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            rankingJsonLd({ locale, path, title, description, updatedAt: ranking.updatedAt, items, crumbs }),
          ),
        }}
      />
    </div>
  );
}
