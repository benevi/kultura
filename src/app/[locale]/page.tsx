import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { KButton } from "@/components/ui/KButton";

export default async function HomePage() {
  const t = await getTranslations("landing");

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="flex flex-col items-center justify-center text-center px-4 py-24 md:py-40">
          <h1 className="font-display text-6xl md:text-8xl tracking-widest text-text mb-8 max-w-4xl">
            {t("hero.tagline")}
          </h1>
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <KButton variant="primary" size="lg" asChild>
              <Link href="/login?mode=register">{t("hero.cta")}</Link>
            </KButton>
            <KButton variant="secondary" size="lg" asChild>
              <Link href="#features">{t("hero.ctaSecondary")}</Link>
            </KButton>
          </div>
        </section>

        {/* What */}
        <section className="px-4 md:px-8 py-16 text-center max-w-3xl mx-auto">
          <h2 className="font-display text-4xl tracking-wide text-text mb-6">
            {t("what.title")}
          </h2>
          <p className="text-muted text-lg leading-relaxed">
            {t("what.description")}
          </p>
        </section>

        {/* Features */}
        <section id="features" className="px-4 md:px-8 py-16 max-w-6xl mx-auto">
          <h2 className="font-display text-4xl tracking-wide text-text text-center mb-12">
            {t("features.title")}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {/* Library */}
            <div className="bg-surface rounded-xl border border-border p-6 flex flex-col gap-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-8 h-8 text-accent-positive"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
                />
              </svg>
              <div>
                <h3 className="font-medium text-text mb-1">{t("features.library")}</h3>
                <p className="text-muted text-sm leading-relaxed">{t("features.libraryDesc")}</p>
              </div>
            </div>

            {/* Friends */}
            <div className="bg-surface rounded-xl border border-border p-6 flex flex-col gap-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-8 h-8 text-accent-positive"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
                />
              </svg>
              <div>
                <h3 className="font-medium text-text mb-1">{t("features.friends")}</h3>
                <p className="text-muted text-sm leading-relaxed">{t("features.friendsDesc")}</p>
              </div>
            </div>

            {/* Lists */}
            <div className="bg-surface rounded-xl border border-border p-6 flex flex-col gap-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-8 h-8 text-accent-positive"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z"
                />
              </svg>
              <div>
                <h3 className="font-medium text-text mb-1">{t("features.lists")}</h3>
                <p className="text-muted text-sm leading-relaxed">{t("features.listsDesc")}</p>
              </div>
            </div>

            {/* AI */}
            <div className="bg-surface rounded-xl border border-border p-6 flex flex-col gap-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-8 h-8 text-accent-positive"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
                />
              </svg>
              <div>
                <h3 className="font-medium text-text mb-1">{t("features.ai")}</h3>
                <p className="text-muted text-sm leading-relaxed">{t("features.aiDesc")}</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="bg-surface px-4 md:px-8 py-24 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="font-display text-4xl md:text-5xl tracking-wide text-text mb-4">
              {t("cta.title")}
            </h2>
            <p className="text-muted text-lg mb-8">{t("cta.subtitle")}</p>
            <KButton variant="primary" size="lg" asChild>
              <Link href="/login?mode=register">{t("cta.button")}</Link>
            </KButton>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
