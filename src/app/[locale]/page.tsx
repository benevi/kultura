import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { FEATURE_KEYS, FeatureGrid } from "@/components/landing/FeatureGrid";
import { BestRankings } from "@/components/landing/BestRankings";
import { Hero } from "@/components/landing/Hero";
import { ImmersiveBackdrop } from "@/components/landing/ImmersiveBackdrop";
import { MotionToggle } from "@/components/landing/MotionToggle";
import { HowItWorks, STEP_KEYS } from "@/components/landing/HowItWorks";
import { Comparison } from "@/components/landing/Comparison";
import { Faq } from "@/components/landing/Faq";
import { FinalCta } from "@/components/landing/FinalCta";
import {
  BestRankingsSlot,
  FeatureGridSlot,
  HeroBackdropSlot,
  HeroStripSlot,
  HowItWorksSlot,
} from "@/components/landing/ShowcaseSlots";
import { BEST_FORMATS, bestYears } from "@/lib/best/best-of";
import { IMMERSIVE_FORMATS, parseTitle, type HeroCopy } from "@/lib/landing/immersive";
import { faqJsonLd, faqKeys, type FaqItem } from "@/lib/landing/faq";
import { env } from "@/lib/env";
import { siteUrl } from "@/lib/site-url";
import type { MediaType } from "@/types/media";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const l = locale === "en" ? "en" : "es";
  const t = await getTranslations({ locale: l, namespace: "landing" });
  // D-11: la misma promesa que el h1 en <title>, OG y la tarjeta de X.
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

export default async function HomePage() {
  const t = await getTranslations("landing");
  const tb = await getTranslations("best");
  const ts = await getTranslations("status");
  const tq = await getTranslations("search");
  const locale = await getLocale();
  const demo = env.DEMO_USER_EMAIL ? t("hero.demo") : undefined;

  const formats = Object.fromEntries(
    IMMERSIVE_FORMATS.map((type) => [type, t(`formats.${type}`)])
  ) as Record<MediaType, string>;

  const hero: HeroCopy = {
    title: parseTitle(t.raw("hero.title") as string),
    sub: t("hero.sub"),
    badge: t("hero.badge"),
    cta: t("hero.cta"),
    // E-DEMO: el botón solo existe si la cuenta demo está configurada.
    demo,
    locale,
  };

  // Etiquetas ya traducidas: los componentes son síncronos y no vuelven a
  // pedir traducciones.
  const features = Object.fromEntries(
    FEATURE_KEYS.map((key) => [key, { title: t(`features.${key}`), desc: t(`features.${key}Desc`) }])
  ) as Parameters<typeof FeatureGrid>[0]["features"];
  const featureProps = { features, aiChip: t("features.aiChip") };

  const howProps = {
    heading: t("how.title"),
    steps: Object.fromEntries(
      STEP_KEYS.map((key) => [key, { title: t(`how.steps.${key}.title`), desc: t(`how.steps.${key}.desc`) }])
    ) as Parameters<typeof HowItWorks>[0]["steps"],
    statusLabel: ts("completed"),
    searchPlaceholder: tq("placeholder"),
  };

  const [year, ...olderYears] = bestYears();
  const bestCopy = Object.fromEntries(
    BEST_FORMATS.map((f) => [f, { label: tb(`chip.${f}`), title: tb(`title.${f}`, { year }) }])
  ) as Parameters<typeof BestRankings>[0]["copy"];
  const rankingsProps = {
    year,
    heading: t("rankings.title", { year }),
    sub: t("rankings.sub"),
    cta: t("rankings.cta"),
    copy: bestCopy,
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
    <div className="min-h-screen flex flex-col isolate">
      {/* Primero en el orden de foco (ACC-6): pausar la animación de fondo. */}
      <MotionToggle pauseLabel={t("motion.pause")} region={t("motion.region")} />
      <Header />
      <main className="flex-1">
        {/* Hero único (D-11): el mensaje y los botones son HTML del primer
            pintado; solo el fondo y la tira de portadas esperan a la muestra. */}
        <Hero
          copy={hero}
          backdrop={
            <Suspense fallback={<ImmersiveBackdrop items={[]} />}>
              <HeroBackdropSlot locale={locale} />
            </Suspense>
          }
          strip={
            <Suspense fallback={null}>
              <HeroStripSlot locale={locale} />
            </Suspense>
          }
        />

        <section
          aria-labelledby="features-title"
          className="px-4 md:px-8 pt-20 md:pt-28 pb-20 md:pb-28 max-w-6xl mx-auto"
        >
          <h2
            id="features-title"
            className="font-display text-4xl md:text-6xl font-extrabold tracking-[-0.03em] text-text-primary mb-12 max-w-[14ch]"
          >
            {t("features.title")}
          </h2>
          <Suspense fallback={<FeatureGrid {...featureProps} />}>
            <FeatureGridSlot locale={locale} {...featureProps} />
          </Suspense>
        </section>

        <Suspense fallback={<HowItWorks {...howProps} />}>
          <HowItWorksSlot locale={locale} {...howProps} />
        </Suspense>

        {/* Rankings públicos: entrada a /best/[formato]/[año]. */}
        <Suspense fallback={<BestRankings {...rankingsProps} />}>
          <BestRankingsSlot locale={locale} {...rankingsProps} />
        </Suspense>

        <Comparison
          heading={t("compare.title")}
          sub={t("compare.sub")}
          formats={formats}
          kulturaLabel={t("compare.kultura")}
          appHeader={t("compare.appHeader")}
          formatsHeader={t("compare.formatsHeader")}
          note={t("compare.note")}
        />

        <Faq heading={t("faq.title")} items={faq} />

        <FinalCta title={t("final.title")} sub={t("final.sub")} cta={hero.cta} demo={demo} locale={locale} />
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </div>
  );
}
