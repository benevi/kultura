import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { FeatureGrid, FEATURE_KEYS } from "@/components/landing/FeatureGrid";
import { ImmersiveHero } from "@/components/landing/ImmersiveHero";
import { IMMERSIVE_FORMATS, type ImmersiveCopy } from "@/lib/landing/immersive";
import { ImmersiveHeroSlot } from "@/components/landing/ShowcaseSlots";

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
    scrollHint: t("immersive.scrollHint"),
    kicker: t("immersive.kicker"),
    finalTitle: t("immersive.finalTitle"),
    finalSub: t("immersive.finalSub"),
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
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-text-primary text-center mb-12">
            {t("features.title")}
          </h2>
          <FeatureGrid features={features} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
