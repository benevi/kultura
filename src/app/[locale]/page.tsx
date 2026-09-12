import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { KButton } from "@/components/ui/KButton";
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

const FEATURE_KEYS = ["library", "friends", "lists", "ai"] as const;

export default async function HomePage() {
  const t = await getTranslations("landing");

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="px-4 md:px-8 pt-14 md:pt-20 pb-16 md:pb-24">
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
            </div>

            {/* Collage decorativo — mismo primitivo de "poster sin imagen real"
                (gradiente de dos paradas, mismo matiz, segunda parada más
                oscura vía el token on-accent-*) + rotación de cards + badge
                colgante con sombra dura, sin desenfoque (F0). */}
            <div
              className="relative h-64 sm:h-80 md:h-96 mx-auto w-full max-w-xs hidden sm:block"
              aria-hidden="true"
            >
              <div
                className="absolute left-0 top-8 w-28 md:w-36 aspect-[2/3] rounded-bento rotate-[-6deg] flex items-center justify-center"
                style={{ background: "linear-gradient(155deg, var(--accent-pink), var(--on-accent-pink))" }}
              >
                <IconLibrary className="w-9 h-9 md:w-10 md:h-10 text-on-accent-pink opacity-70" />
              </div>
              <div
                className="absolute right-2 top-0 w-28 md:w-36 aspect-[2/3] rounded-bento rotate-[5deg] flex items-center justify-center"
                style={{ background: "linear-gradient(155deg, var(--accent-purple), var(--on-accent-purple))" }}
              >
                <IconSparkles className="w-9 h-9 md:w-10 md:h-10 text-on-accent-purple opacity-70" />
              </div>
              <div
                className="absolute left-1/2 -translate-x-1/2 bottom-0 w-28 md:w-36 aspect-[2/3] rounded-bento rotate-[-2deg] flex items-center justify-center"
                style={{ background: "linear-gradient(155deg, var(--accent-lime), var(--on-accent-lime))" }}
              >
                <IconLists className="w-9 h-9 md:w-10 md:h-10 text-on-accent-lime opacity-70" />
              </div>

              {/* Badge colgante (mismo patrón que el badge de match de MediaCard/
                  MediaDetail): pill de color vivo + sombra dura tipo pegatina. */}
              <div
                className="absolute top-1/3 right-0 translate-x-1/4 rotate-[-8deg] rounded-full bg-accent-lime text-on-accent-lime text-xs font-display font-extrabold px-3 py-1.5 leading-none whitespace-nowrap"
                style={{ boxShadow: "4px 4px 0 rgba(0,0,0,.4)" }}
              >
                {t("hero.badge")}
              </div>
            </div>
          </div>
        </section>

        {/* What */}
        <section className="px-4 md:px-8 py-16 text-center max-w-3xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-text-primary mb-6 text-balance">
            {t("what.title")}
          </h2>
          <p className="text-text-secondary text-lg leading-relaxed">
            {t("what.description")}
          </p>
        </section>

        {/* Features */}
        <section id="features" className="px-4 md:px-8 py-16 max-w-6xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-text-primary text-center mb-12">
            {t("features.title")}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {FEATURE_KEYS.map((key, i) => {
              const { icon: Icon, bg, text } = FEATURE_ACCENTS[i];
              // Rotación sutil alternada — solo en el grid desktop, solo las
              // piezas del bento (F0 §Rotación de cards). Se endereza al hover.
              const rotate = i % 2 === 0 ? "md:rotate-[-1.2deg]" : "md:rotate-[1deg]";
              return (
                <div
                  key={key}
                  className={cn(
                    "bg-surface-default border border-surface-border rounded-bento p-5 md:p-6 flex flex-col gap-4",
                    "transition-transform duration-base ease-standard hover:rotate-0",
                    rotate
                  )}
                >
                  <div className={cn("w-11 h-11 md:w-12 md:h-12 rounded-2xl flex items-center justify-center shrink-0", bg)}>
                    <Icon className={cn("w-5 h-5 md:w-6 md:h-6", text)} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-text-primary mb-1">
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

        {/* CTA final — "card feature grande": gradiente radial de acento en la
            esquina superior-izquierda sobre superficie sólida (mismo primitivo
            que las cards destacadas del bento). */}
        <section className="px-4 md:px-8 py-10 md:py-16">
          <div
            className="relative overflow-hidden rounded-bento-lg max-w-4xl mx-auto px-6 md:px-16 py-16 md:py-20 text-center border border-surface-border"
            style={{
              backgroundColor: "var(--surface-elevated)",
              backgroundImage:
                "radial-gradient(120% 100% at 20% 10%, rgba(255,79,163,0.35), transparent 55%)",
            }}
          >
            <h2 className="relative font-display text-3xl md:text-5xl font-extrabold tracking-tight text-text-primary mb-4 text-balance">
              {t("cta.title")}
            </h2>
            <p className="relative text-text-secondary text-lg mb-8">{t("cta.subtitle")}</p>
            <KButton variant="primary" size="lg" asChild className="relative">
              <Link href="/login?mode=register">{t("cta.button")}</Link>
            </KButton>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
