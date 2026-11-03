import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { isAppLocale } from "@/i18n/detect";
import { routing } from "@/i18n/routing";
import { Logo } from "@/components/layout/Logo";
import { KButton } from "@/components/ui/KButton";
import { RetryButton } from "@/components/pwa/RetryButton";

// ============================================================
// KULTURA — /[locale]/offline (MOV-2, D-02)
//
// La única página que guarda el service worker (`public/sw.js`): la sirve
// cuando una navegación falla por falta de red. Por eso no lee la sesión, ni
// cookies, ni cabeceras, ni ningún proveedor: tiene que ser la misma para
// todo el mundo y poder servirse estática y cacheada (lista de rutas
// estáticas de F-22). Sin cabecera de la app: sus enlaces llevarían a páginas
// que sin red tampoco cargan.
// ============================================================

interface Props {
  params: Promise<{ locale: string }>;
}

/** Solo es/en: la página se genera en el build y sale del CDN (D-02, F-22). */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "pwa.offline" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function OfflinePage({ params }: Props) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  // Sin esto next-intl leería el idioma de las cabeceras y la página dejaría
  // de ser estática.
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "pwa.offline" });

  return (
    // Página impresa del álbum, sin cabecera: sus enlaces llevarían a páginas
    // que sin red tampoco cargan. El hueco vacío con su número es lo que falta
    // mientras no vuelve la conexión.
    <main id="main" tabIndex={-1} className="theme-paper flex min-h-dvh flex-col bg-surface-base">
      <div className="page-grid flex flex-1 flex-col justify-center gap-6 py-12">
        <Logo size={28} />
        <div className="flex items-start gap-6">
          <div aria-hidden="true" className="relative hidden aspect-[2/3] w-24 shrink-0 rounded-cromo border-2 border-dashed border-slot-line sm:block">
            <svg
              viewBox="0 0 24 24"
              width="36"
              height="36"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-text-tertiary"
            >
              <path d="M2 8.8a15 15 0 0 1 4.2-2.6M9.9 5.1A15 15 0 0 1 22 8.8M5 12.4a10 10 0 0 1 3.6-2.2M15.5 10.4A10 10 0 0 1 19 12.4M8.5 16a5 5 0 0 1 7 0M12 20h.01M3 3l18 18" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-balance font-display text-3xl text-text-primary md:text-4xl">{t("title")}</h1>
            <div className="mt-4 max-w-[46ch] space-y-3 text-base text-text-secondary">
              <p>{t("body")}</p>
              <p className="text-sm">{t("safe")}</p>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <RetryButton label={t("retry")} homeHref={`/${locale}`} />
              <KButton asChild variant="secondary">
                <a href={`/${locale}`}>{t("home")}</a>
              </KButton>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
