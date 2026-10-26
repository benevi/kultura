// ============================================================
// KULTURA — /best/[format]/[year] (Server Component, PÚBLICA)
// "Los mejores animes de 2026": contenido indexable sin cuenta. Vive FUERA de
// `(app)` (que redirige a login). Los datos se regeneran cada 24 h; si el
// proveedor falla al regenerar, se conserva la última versión buena.
//
// F-16: migas, selector de formato y de año, criterio y fecha visibles,
// podio + lista compacta con enlace a la ficha y "Guardar", un solo
// "Compartir" tras el top 3, alta "Guarda los que te faltan" y JSON-LD
// (`CollectionPage` + `BreadcrumbList` + `ItemList` con `url` e `image`).
// Una lista con menos de BEST_INDEX_MIN_ITEMS títulos se publica con aviso
// pero `noindex` (y fuera del sitemap); vacía, con un estado propio.
// ============================================================

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { BestPodium, BestRankList } from "@/components/best/BestOfList";
import { BestBreadcrumbs, BestCta, BestFormatNav, BestYearNav } from "@/components/best/BestNav";
import { ShareRanking } from "@/components/best/ShareRanking";
import {
  bestYears,
  getBestRanking,
  isIndexableRanking,
  parseBestParams,
  type BestFormat,
} from "@/lib/best/best-of";
import { bestLocale, bestMetadata, rankingJsonLd, serializeJsonLd, type Crumb } from "@/lib/best/seo";
import { localeHref } from "@/lib/best/links";

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
  const crumbs = await crumbsFor(locale, parsed.format, parsed.year);
  const years = bestYears();
  const previousYear = years.find((y) => y < parsed.year);
  const updated = new Date(ranking.updatedAt);
  const updatedLabel = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "Europe/Madrid" }).format(updated);

  return (
    <div className="min-h-screen flex flex-col">
      <Header locale={locale} />
      <main id="main" className="page-grid [&>*]:max-w-4xl flex-1 py-8 md:py-10 flex flex-col gap-8 md:gap-10">
        <header className="flex flex-col gap-4">
          <BestBreadcrumbs locale={locale} crumbs={crumbs} />
          <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight text-text-primary">{title}</h1>
          <p className="text-body text-text-secondary max-w-prose">
            {t(`intro.${parsed.format}`, { year: parsed.year })}
          </p>
          <p className="text-meta text-text-tertiary max-w-prose">
            {t(`criteria.${parsed.format}`, { year: parsed.year, min: ranking.minVotes ?? 0 })}{" "}
            {t.rich("updated", {
              date: updatedLabel,
              time: (chunks) => <time dateTime={ranking.updatedAt}>{chunks}</time>,
            })}
          </p>
          <div className="flex flex-col gap-3 pt-1">
            <BestFormatNav
              locale={locale}
              current={parsed.format}
              hrefFor={(f) => `/best/${f}/${parsed.year}`}
            />
            <BestYearNav locale={locale} format={parsed.format} years={years} current={parsed.year} />
          </div>
        </header>

        {items.length === 0 ? (
          <section className="flex flex-col items-start gap-3 rounded-bento bg-surface-default p-6 md:p-8">
            <h2 className="font-display text-2xl font-extrabold text-text-primary">
              {t("empty.title", { year: parsed.year })}
            </h2>
            <p className="max-w-prose text-body text-text-secondary">
              {t("empty.body", { year: parsed.year, noun: t(`noun.${parsed.format}`) })}
            </p>
            {previousYear ? (
              <a
                href={localeHref(locale, `/best/${parsed.format}/${previousYear}`)}
                className="inline-flex h-11 items-center rounded-full bg-accent-pink px-6 text-base font-extrabold text-on-accent-pink transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
              >
                {t("empty.previous", { year: previousYear })}
              </a>
            ) : null}
          </section>
        ) : (
          <>
            {!isIndexableRanking(items.length) ? (
              <p role="note" className="rounded-bento border-2 border-stroke px-4 py-3 text-sm text-text-secondary">
                {t("provisional", { count: items.length })}
              </p>
            ) : null}
            <BestPodium items={items} locale={locale} />
            <ShareRanking path={localeHref(locale, path)} title={title} />
            <BestRankList items={items} locale={locale} />
          </>
        )}

        <BestCta locale={locale} year={parsed.year} returnTo={localeHref(locale, path)} />
      </main>
      <Footer />
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
