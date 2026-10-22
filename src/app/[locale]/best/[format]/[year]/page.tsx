// ============================================================
// KULTURA — /best/[format]/[year] (Server Component, PÚBLICA)
// "Mejores animes de 2026": contenido indexable sin cuenta. Vive FUERA de
// `(app)` (que redirige a login). Se regenera cada 24 h; si el proveedor falla
// al regenerar, Next conserva la última versión buena.
// ============================================================

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { BestOfList } from "@/components/best/BestOfList";
import { SignUpCta } from "@/components/collection/PublicCollection";
import { ShareRanking } from "@/components/best/ShareRanking";
import { Link } from "@/i18n/navigation";
import { getBestOf, parseBestParams, bestYears, BEST_FORMATS } from "@/lib/best/best-of";
import { siteUrl } from "@/lib/site-url";

export const revalidate = 86400;

interface Props {
  params: Promise<{ locale: string; format: string; year: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, format, year } = await params;
  const parsed = parseBestParams(format, year);
  if (!parsed) return {};
  const t = await getTranslations("best");
  const l = locale === "en" ? "en" : "es";
  const base = siteUrl();
  const path = `best/${parsed.format}/${parsed.year}`;
  const title = t(`title.${parsed.format}`, { year: parsed.year });
  const description = t(`description.${parsed.format}`, { year: parsed.year });
  return {
    title,
    description,
    alternates: {
      canonical: `${base}/${l}/${path}`,
      languages: {
        es: `${base}/es/${path}`,
        en: `${base}/en/${path}`,
        "x-default": `${base}/es/${path}`,
      },
    },
    openGraph: { title: `${title} · KULTURA`, description, type: "article" },
    twitter: { card: "summary_large_image", title: `${title} · KULTURA`, description },
  };
}

export default async function BestOfPage({ params }: Props) {
  const { locale, format, year } = await params;
  const parsed = parseBestParams(format, year);
  if (!parsed) notFound();

  const t = await getTranslations("best");
  const items = await getBestOf(parsed.format, parsed.year, locale);
  const title = t(`title.${parsed.format}`, { year: parsed.year });
  const url = `${siteUrl()}/${locale}/best/${parsed.format}/${parsed.year}`;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-8 py-10 flex flex-col gap-10">
        <header className="flex flex-col gap-3">
          <h1 className="font-display text-3xl md:text-[42px] font-bold text-text-primary">
            {title}
          </h1>
          <p className="text-[15px] text-text-secondary max-w-prose">
            {t(`intro.${parsed.format}`, { year: parsed.year })}
          </p>
          <nav aria-label={t("otherLabel")} className="flex flex-wrap gap-2 pt-2">
            {BEST_FORMATS.filter((f) => f !== parsed.format).map((f) => (
              <Link
                key={f}
                href={`/best/${f}/${parsed.year}`}
                className="rounded-full bg-surface-elevated px-4 py-2 text-[13px] font-bold text-text-primary"
              >
                {t(`chip.${f}`)}
              </Link>
            ))}
            {bestYears()
              .filter((y) => y !== parsed.year)
              .map((y) => (
                <Link
                  key={y}
                  href={`/best/${parsed.format}/${y}`}
                  className="rounded-full border-2 border-stroke px-4 py-2 text-[13px] font-bold text-text-primary"
                >
                  {y}
                </Link>
              ))}
          </nav>
        </header>

        <ShareRanking path={`/${locale}/best/${parsed.format}/${parsed.year}`} title={title} />
        <BestOfList items={items} label={title} />
        <SignUpCta />
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: title,
            url,
            numberOfItems: items.length,
            itemListElement: items.map((item, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: item.title,
            })),
          }).replace(/</g, "\\u003c"),
        }}
      />
    </div>
  );
}
