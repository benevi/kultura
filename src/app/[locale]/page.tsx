import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { getAlbumLabels } from "@/components/album/labels.server";
import { AlbumHero, MissingPagePlaceholder } from "@/components/landing/AlbumHero";
import { BestPage } from "@/components/landing/BestPage";
import { FLAP_FORMATS, type FlapSearchLabels } from "@/components/landing/FlapSearch";
import { Ritual, RITUAL_STATUSES, RITUAL_STEPS } from "@/components/landing/Ritual";
import { FormatSections } from "@/components/landing/FormatSections";
import { RankingChecklist } from "@/components/landing/RankingChecklist";
import { Comparison } from "@/components/landing/Comparison";
import { Trust, TRUST_KEYS } from "@/components/landing/Trust";
import { Faq } from "@/components/landing/Faq";
import { FinalCta } from "@/components/landing/FinalCta";
import {
  BestPageSlot,
  FormatSectionsSlot,
  MissingPageSlot,
  RankingChecklistSlot,
  RitualSlot,
} from "@/components/landing/ShowcaseSlots";
import { BEST_FORMATS, bestYears, type BestFormat } from "@/lib/best/best-of";
import { FORMATS } from "@/lib/design/album";
import { ALBUM_PAGE_SIZE } from "@/lib/landing/album";
import { faqJsonLd, faqKeys, type FaqItem } from "@/lib/landing/faq";
import { env } from "@/lib/env.server";
import { siteUrl } from "@/lib/site-url";
import type { MediaType } from "@/types/media";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ locale: string }>;
}

// D-02: la portada sale del CDN. Se pinta en el build (un HTML por idioma) y
// se regenera cada día, como la muestra de portadas y los rankings que enseña.
export const revalidate = 86400;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const l = locale === "en" ? "en" : "es";
  setRequestLocale(l);
  const t = await getTranslations({ locale: l, namespace: "landing" });
  // D-11: la misma promesa en <title>, OG y la tarjeta de X.
  const title = t("seo.title");
  const description = t("seo.description");
  const base = siteUrl();
  const url = `${base}/${l}`;
  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: url,
      languages: { es: `${base}/es`, en: `${base}/en`, "x-default": `${base}/es` },
    },
    // Objeto completo: el de la página SUSTITUYE al del layout (no se mezcla),
    // así que `siteName` y `type` tienen que repetirse aquí. La imagen la pone
    // `opengraph-image.tsx` (y Next la copia a `twitter:image`).
    openGraph: {
      title,
      description,
      url,
      siteName: "KULTURA",
      type: "website",
      locale: l === "en" ? "en_US" : "es_ES",
      alternateLocale: l === "en" ? ["es_ES"] : ["en_US"],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function HomePage({ params }: Props) {
  const locale = (await params).locale === "en" ? "en" : "es";
  setRequestLocale(locale);
  const [t, tb, ts, album] = await Promise.all([
    getTranslations({ locale, namespace: "landing" }),
    getTranslations({ locale, namespace: "best" }),
    getTranslations({ locale, namespace: "status" }),
    getAlbumLabels(locale),
  ]);
  // E-DEMO: el botón solo existe si la cuenta demo está configurada.
  const demo = env.DEMO_USER_EMAIL ? t("hero.demo") : undefined;
  const basePath = `/${locale}`;
  const [year, ...olderYears] = bestYears();

  const names = Object.fromEntries(FORMATS.map((f) => [f, t(`formats.${f}`)])) as Record<MediaType, string>;
  const formatLabels = Object.fromEntries(FORMATS.map((f) => [f, album.format(f)])) as Record<MediaType, string>;
  const status = Object.fromEntries(RITUAL_STATUSES.map((s) => [s, ts(s)])) as Parameters<typeof Ritual>[0]["status"];

  // Textos ya traducidos: los componentes son síncronos (o de cliente) y no
  // vuelven a pedir traducciones. Las plantillas con `{q}` se rellenan en el
  // cliente.
  const search: FlapSearchLabels = {
    label: t("search.label"),
    placeholder: t("search.placeholder"),
    submit: t("search.submit"),
    formats: t("search.formats"),
    family: Object.fromEntries(
      FLAP_FORMATS.map((f) => [f, f === "all" ? t("search.all") : names[f]])
    ) as FlapSearchLabels["family"],
    loading: t("search.loading"),
    results: t.raw("search.results") as string,
    empty: t.raw("search.empty") as string,
    error: t("search.error"),
    save: t("search.save"),
    format: formatLabels,
  };

  const bestProps = {
    heading: t("album.best", { year }),
    linkLabel: t("album.bestLink"),
    basePath,
  };
  const missingProps = {
    heading: t("album.missing"),
    startNumber: ALBUM_PAGE_SIZE + 1,
    formatLabels,
  };

  const ritualProps = {
    heading: t("ritual.title"),
    steps: Object.fromEntries(
      RITUAL_STEPS.map((k) => [k, { title: t(`ritual.${k}.title`), desc: t(`ritual.${k}.desc`) }])
    ) as Parameters<typeof Ritual>[0]["steps"],
    status,
    format: formatLabels,
    locale,
  };

  const sectionsProps = {
    heading: t("sections.title"),
    names,
    tracks: Object.fromEntries(FORMATS.map((f) => [f, t(`sections.tracks.${f}`)])) as Record<MediaType, string>,
  };

  const rankingsProps = {
    basePath,
    locale,
    year,
    heading: t("rankings.title", { year }),
    cta: t("rankings.cta"),
    titles: Object.fromEntries(BEST_FORMATS.map((f) => [f, tb(`title.${f}`, { year })])) as Record<BestFormat, string>,
    ratingLabel: tb.raw("rating") as string,
    // SEO-9: además de los cuatro del año, enlaces a todos los anteriores.
    previous: {
      label: t("rankings.previous"),
      years: olderYears.map((y) => ({
        year: y,
        links: BEST_FORMATS.map((f) => ({ format: f, label: tb(`chip.${f}`), title: tb(`title.${f}`, { year: y }) })),
      })),
    },
  };

  const faq: FaqItem[] = faqKeys(Boolean(demo)).map((key) => ({
    key,
    q: t(`faq.${key}.q`),
    a: t(`faq.${key}.a`),
  }));

  const base = siteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "KULTURA",
        url: `${base}/${locale}`,
        description: t("seo.description"),
        applicationCategory: "EntertainmentApplication",
        operatingSystem: "Web",
        inLanguage: locale,
        offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
      },
      faqJsonLd(faq),
    ],
  };

  return (
    // Página impresa del álbum: la cabecera, los botones y los campos se
    // re-visten de papel solos (`theme-paper`).
    <div className="theme-paper isolate flex min-h-screen flex-col">
      <Header locale={locale} />
      <main className="flex-1">
        {/* El álbum abierto (primera pantalla): el titular, la solapa y las dos
            páginas son HTML del primer pintado; las portadas llegan por
            streaming y el sobre, si el equipo puede, después. */}
        <AlbumHero
          copy={{
            title: t("hero.title"),
            sub: t("hero.sub"),
            cta: t("hero.cta"),
            demo,
            locale,
            region: t("album.region"),
          }}
          search={search}
          left={
            <Suspense fallback={<BestPage {...bestProps} items={[]} />}>
              <BestPageSlot locale={locale} year={year} {...bestProps} />
            </Suspense>
          }
          right={
            <Suspense fallback={<MissingPagePlaceholder heading={missingProps.heading} startNumber={missingProps.startNumber} />}>
              <MissingPageSlot locale={locale} year={year} pendingLabel={album.slotPending} {...missingProps} />
            </Suspense>
          }
        />

        <Suspense fallback={<Ritual {...ritualProps} covers={[]} />}>
          <RitualSlot {...ritualProps} />
        </Suspense>

        <Suspense fallback={<FormatSections {...sectionsProps} covers={[]} />}>
          <FormatSectionsSlot locale={locale} {...sectionsProps} />
        </Suspense>

        {/* Rankings públicos: entrada a /best/[formato]/[año]. */}
        <Suspense fallback={<RankingChecklist {...rankingsProps} />}>
          <RankingChecklistSlot {...rankingsProps} />
        </Suspense>

        <Comparison
          heading={t("compare.title")}
          sub={t("compare.sub")}
          formats={names}
          appHeader={t("compare.appHeader")}
          formatsHeader={t("compare.formatsHeader")}
          formatHeader={t("compare.formatHeader")}
          specialistHeader={t("compare.specialistHeader")}
          yes={t("compare.yes")}
          no={t("compare.no")}
          none={t("compare.none")}
          note={t("compare.note")}
        />

        <Trust
          heading={t("trust.title")}
          blocks={
            Object.fromEntries(
              TRUST_KEYS.map((k) => [k, { title: t(`trust.${k}.title`), body: t(`trust.${k}.body`) }])
            ) as Parameters<typeof Trust>[0]["blocks"]
          }
          rankingsHref={`${basePath}/best`}
          rankingsLabel={t("album.bestLink")}
        />

        <Faq heading={t("faq.title")} items={faq} />

        <FinalCta title={t("final.title")} sub={t("final.sub")} cta={t("hero.cta")} demo={demo} locale={locale} />
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </div>
  );
}
