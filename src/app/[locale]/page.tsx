import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { KButton } from "@/components/ui/KButton";
import {
  HeroCollage,
  HeroStrip,
  HERO_COLLAGE_SLOTS,
} from "@/components/landing/HeroCollage";
import {
  FeatureVisual,
  FEATURE_POSTER_COST,
  type FeatureKey,
} from "@/components/landing/FeatureVisual";
import { getLandingShowcase } from "@/lib/landing/showcase";
import { IconLibrary, IconFriends, IconLists, IconSparkles, type KIcon } from "@/components/icons";
import { cn } from "@/lib/utils/index";

// Acentos DECORATIVOS (F7) — mismo criterio que Logo/MediaCard: variedad
// visual sin rol semántico, un color distinto por feature (sin patrón, solo
// para no repetir accent-positive fuera de su rol interactivo).
const FEATURE_ACCENTS: { icon: KIcon; bg: string; text: string }[] = [
  { icon: IconLibrary, bg: "bg-accent-pink", text: "text-on-accent-pink" },
  { icon: IconFriends, bg: "bg-accent-lime", text: "text-on-accent-lime" },
  { icon: IconLists, bg: "bg-accent-purple", text: "text-on-accent-purple" },
  { icon: IconSparkles, bg: "bg-accent-orange", text: "text-on-accent-orange" },
];

const FEATURE_KEYS: FeatureKey[] = ["library", "friends", "lists", "ai"];

export default async function HomePage() {
  const t = await getTranslations("landing");
  const locale = await getLocale();

  // E-LANDING-SHOWCASE: portadas reales del catálogo (una por familia primero).
  // Cacheadas un día; si no hay, cada pieza cae a su versión de gradiente.
  const showcase = await getLandingShowcase(locale);

  // Reparto explícito de la muestra: el hero primero (es lo que se ve sin
  // scroll), y cada feature consume el trozo que necesita (FEATURE_POSTER_COST).
  const heroPosters = showcase.slice(0, HERO_COLLAGE_SLOTS);
  let cursor = HERO_COLLAGE_SLOTS;
  const featurePosters = FEATURE_KEYS.map((key) => {
    const slice = showcase.slice(cursor, cursor + FEATURE_POSTER_COST[key]);
    cursor += FEATURE_POSTER_COST[key];
    return slice;
  });

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
              <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                <KButton variant="primary" size="lg" asChild>
                  <Link href="/login?mode=register">{t("hero.cta")}</Link>
                </KButton>
                <KButton variant="secondary" size="lg" asChild>
                  <Link href="#features">{t("hero.ctaSecondary")}</Link>
                </KButton>
              </div>
              {/* Móvil: el collage no cabe, así que va una tira de portadas —
                  antes el hero en móvil era solo texto. */}
              <HeroStrip items={showcase} />
            </div>

            <HeroCollage items={heroPosters} badge={t("hero.badge")} />
          </div>
        </section>

        {/* Features */}
        <section id="features" className="px-4 md:px-8 pb-20 md:pb-28 max-w-6xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-text-primary text-center mb-12">
            {t("features.title")}
          </h2>
          {/* 4 columnas solo a partir de lg: a md las cuatro tarjetas dejaban el
              texto en columnas de dos palabras. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURE_KEYS.map((key, i) => {
              const { icon: Icon, bg, text } = FEATURE_ACCENTS[i];
              // Rotación sutil alternada — solo en el grid desktop, solo las
              // piezas del bento (F0 §Rotación de cards). Se endereza al hover.
              const rotate = i % 2 === 0 ? "lg:rotate-[-1.2deg]" : "lg:rotate-[1deg]";
              return (
                <div
                  key={key}
                  className={cn(
                    "bg-surface-default border border-surface-border rounded-bento p-6 flex flex-col gap-5",
                    "transition-transform duration-base ease-standard hover:rotate-0",
                    rotate
                  )}
                >
                  {/* Icono + ilustración con portadas reales del catálogo. */}
                  <div className="flex items-start justify-between gap-3 min-h-[80px]">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", bg)}>
                      <Icon className={cn("w-6 h-6", text)} />
                    </div>
                    <FeatureVisual
                      feature={key}
                      items={featurePosters[i]}
                      aiBadge={t("features.aiBadge")}
                    />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-text-primary mb-1.5">
                      {t(`features.${key}`)}
                    </h3>
                    <p className="text-text-secondary text-sm leading-relaxed">
                      {t(`features.${key}Desc`)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
