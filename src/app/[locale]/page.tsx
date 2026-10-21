import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { FeatureGrid, FEATURE_KEYS } from "@/components/landing/FeatureGrid";
import { ImmersiveHero } from "@/components/landing/ImmersiveHero";
import { IMMERSIVE_FORMATS, type ImmersiveCopy } from "@/lib/landing/immersive";
import { ImmersiveHeroSlot } from "@/components/landing/ShowcaseSlots";
import { env } from "@/lib/env";
import { siteUrl } from "@/lib/site-url";
import type { Metadata } from "next";

const SEO = {
  es: {
    title: "KULTURA — Registra películas, series, anime, manga, juegos y libros",
    description:
      "Tu watchlist de películas, series, anime, manga, videojuegos, libros y cómics en un solo sitio. Puntúa, comparte listas con amigos y recibe recomendaciones con IA. Gratis.",
  },
  en: {
    title: "KULTURA — Track movies, TV, anime, manga, games and books",
    description:
      "One watchlist for movies, TV, anime, manga, video games, books and comics. Rate, share lists with friends and get AI recommendations. Free.",
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const l = locale === "en" ? "en" : "es";
  const { title, description } = SEO[l];
  const base = siteUrl();
  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: `${base}/${l}`,
      languages: { es: `${base}/es`, en: `${base}/en`, "x-default": `${base}/es` },
    },
    openGraph: { title, description, locale: l === "en" ? "en_US" : "es_ES" },
    twitter: { title, description },
  };
}

export default async function HomePage() {
  const t = await getTranslations("landing");
  const locale = await getLocale();

  // Etiquetas ya traducidas: FeatureGrid es síncrono y no vuelve a pedir
  // traducciones.
  const features = Object.fromEntries(
    FEATURE_KEYS.map((key) => [
      key,
      { title: t(`features.${key}`), desc: t(`features.${key}Desc`) },
    ])
  ) as Parameters<typeof FeatureGrid>[0]["features"];

  const immersive: ImmersiveCopy = {
    title: t("immersive.title"),
    titleAccent: t("immersive.titleAccent"),
    sub: t("immersive.sub"),
    badge: t("hero.badge"),
    finalTitle: t("immersive.finalTitle"),
    finalSub: t("immersive.finalSub"),
    locale,
    // E-DEMO: el botón solo existe si la cuenta demo está configurada.
    demo: env.DEMO_USER_EMAIL ? t("immersive.demo") : undefined,
    cta: t("hero.cta"),
    staticTagline: t("hero.tagline"),
    staticCta: t("hero.cta"),
    formats: Object.fromEntries(
      IMMERSIVE_FORMATS.map((type) => [type, t(`immersive.formats.${type}`)])
    ) as ImmersiveCopy["formats"],
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero inmersivo (E-LANDING-INMERSIVA). El fallback es el MISMO hero
            sin portadas (galería de gradientes F0), así que la landing pinta
            entera sin esperar a ningún proveedor. */}
        <Suspense fallback={<ImmersiveHero items={[]} copy={immersive} />}>
          <ImmersiveHeroSlot locale={locale} copy={immersive} />
        </Suspense>

        {/* Features */}
        <section className="px-4 md:px-8 pt-20 md:pt-28 pb-20 md:pb-28 max-w-6xl mx-auto">
          <h2 className="font-display text-4xl md:text-6xl font-extrabold tracking-[-0.03em] text-text-primary mb-12 max-w-[14ch]">
            {t("features.title")}
          </h2>
          <FeatureGrid features={features} />
        </section>
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "KULTURA",
            url: `${siteUrl()}/${locale}`,
            applicationCategory: "EntertainmentApplication",
            operatingSystem: "Web",
            inLanguage: locale,
            offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
          }).replace(/</g, "\\u003c"),
        }}
      />
    </div>
  );
}
