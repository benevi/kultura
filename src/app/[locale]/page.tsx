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

// Matices de la tira de posters decorativa (F0 Landing).
const POSTER_HUES = [300, 55, 320, 220, 160, 40] as const;

const MEDIA_CHIPS = [
  { key: "movies", emoji: "🎬" },
  { key: "tvs", emoji: "📺" },
  { key: "animes", emoji: "⛩️" },
  { key: "books", emoji: "📚" },
  { key: "comics", emoji: "💥" },
  { key: "mangas", emoji: "🀄" },
  { key: "games", emoji: "🎮" },
] as const;

export default async function HomePage() {
  const t = await getTranslations("landing");
  const tMedia = await getTranslations("media");

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero — F0 Landing: centrado, chip de contexto, titular display con
            pegatina lima rotada, subtítulo muted y dos pills. */}
        <section className="px-4 md:px-14 pt-10 md:pt-10 pb-12 flex flex-col items-center text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-default px-4 py-[9px] text-[13px] font-bold text-text-primary mb-6">
            <span aria-hidden="true">🔮</span>
            {t("hero.chip")}
          </span>
          <h1 className="font-display text-4xl sm:text-5xl md:text-[58px] font-extrabold tracking-tight text-text-primary leading-[1.05] mb-5 max-w-[820px] text-balance">
            {t("hero.tagline")}{" "}
            <span
              aria-hidden="true"
              className="inline-block rotate-[-4deg] rounded-[8px] bg-accent-lime text-on-accent-lime px-3.5 py-0.5"
            >
              ✨
            </span>
          </h1>
          <p className="text-lg leading-relaxed text-text-tertiary max-w-[560px] mb-8">
            {t("what.description")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <KButton variant="primary" size="lg" asChild className="px-8">
              <Link href="/login?mode=register">{t("hero.cta")}</Link>
            </KButton>
            <KButton variant="secondary" size="lg" asChild className="px-8">
              <Link href="#features">{t("hero.ctaSecondary")}</Link>
            </KButton>
          </div>
        </section>

        {/* Tira de posters — "poster sin imagen real": gradiente de dos
            paradas con el mismo matiz, rotación alterna ±1.2–1.4deg (F0). */}
        <section aria-hidden="true" className="px-4 md:px-14 pb-12 flex gap-5">
          {POSTER_HUES.map((hue, i) => (
            <div
              key={hue}
              className={cn(
                "flex-1 h-40 md:h-[260px] rounded-[20px]",
                i >= 3 && "hidden md:block",
                i % 2 === 0 ? "rotate-[-1.4deg]" : "rotate-[1.2deg]"
              )}
              style={{
                background: `linear-gradient(155deg, oklch(50% 0.15 ${hue}), oklch(28% 0.08 ${hue}))`,
              }}
            />
          ))}
        </section>

        {/* Formatos — chips surface con emoji, uno por tipo de contenido */}
        <section className="px-4 md:px-14 pb-16">
          <h2 className="font-display text-2xl md:text-[28px] font-extrabold tracking-tight text-text-primary text-center mb-8 text-balance">
            {t("what.title")}
          </h2>
          <div className="flex gap-4 justify-center flex-wrap">
            {MEDIA_CHIPS.map(({ key, emoji }) => (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface-default px-6 py-3.5 text-[15px] font-bold text-text-primary whitespace-nowrap"
              >
                <span aria-hidden="true">{emoji}</span>
                {tMedia(key)}
              </span>
            ))}
          </div>
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
                    "bg-surface-default rounded-[20px] p-5 md:p-6 flex flex-col gap-4",
                    "transition-transform duration-base ease-standard hover:rotate-0",
                    rotate
                  )}
                >
                  <div className={cn("w-11 h-11 md:w-12 md:h-12 rounded-[14px] flex items-center justify-center shrink-0", bg)}>
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
            className="relative overflow-hidden rounded-[32px] max-w-4xl mx-auto px-6 md:px-16 py-16 md:py-20 text-center"
            style={{
              backgroundColor: "var(--surface-elevated)",
              backgroundImage:
                "radial-gradient(120% 100% at 20% 10%, oklch(68% 0.24 350 / 0.55), transparent 55%)",
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
