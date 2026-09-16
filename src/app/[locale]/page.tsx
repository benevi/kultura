import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { KButton } from "@/components/ui/KButton";
import { HeroCollage, HeroStrip } from "@/components/landing/HeroCollage";
import { FeatureGrid, FEATURE_KEYS } from "@/components/landing/FeatureGrid";
import { HeroCollageSlot, HeroStripSlot } from "@/components/landing/ShowcaseSlots";

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

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="px-4 md:px-8 pt-14 md:pt-20 pb-10 md:pb-14">
          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div className="text-center md:text-left">
              <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-text-primary leading-[1.05] mb-8 text-balance">
                {t("hero.tagline")}
              </h1>
              {/* Un solo CTA: el secundario era un ancla a #features, que con la
                  landing en dos bloques movía la página unos píxeles — un botón
                  que no lleva a ningún sitio. El catálogo no vale como destino:
                  todo lo de (app) redirige a login sin sesión. */}
              <div className="flex justify-center md:justify-start">
                <KButton variant="primary" size="lg" asChild>
                  <Link href="/login?mode=register">{t("hero.cta")}</Link>
                </KButton>
              </div>
              {/* Móvil: el collage no cabe, así que va una tira de portadas —
                  antes el hero en móvil era solo texto. */}
              <Suspense fallback={<HeroStrip items={[]} />}>
                <HeroStripSlot locale={locale} />
              </Suspense>
            </div>

            {/* El fallback es el MISMO collage sin portadas (gradientes F0), así
                que la landing pinta entera sin esperar a ningún proveedor. */}
            <Suspense fallback={<HeroCollage items={[]} badge={t("hero.badge")} />}>
              <HeroCollageSlot locale={locale} badge={t("hero.badge")} />
            </Suspense>
          </div>
        </section>

        {/* Features */}
        <section className="px-4 md:px-8 pb-20 md:pb-28 max-w-6xl mx-auto">
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
