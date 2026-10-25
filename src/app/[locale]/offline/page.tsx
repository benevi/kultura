import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAppLocale } from "@/i18n/detect";
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "pwa.offline" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function OfflinePage({ params }: Props) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "pwa.offline" });

  return (
    <main
      id="main"
      tabIndex={-1}
      className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-surface-base p-8 text-center"
    >
      <Logo size={32} />
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="56"
        height="56"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-text-tertiary"
      >
        <path d="M2 8.8a15 15 0 0 1 4.2-2.6M9.9 5.1A15 15 0 0 1 22 8.8M5 12.4a10 10 0 0 1 3.6-2.2M15.5 10.4A10 10 0 0 1 19 12.4M8.5 16a5 5 0 0 1 7 0M12 20h.01M3 3l18 18" />
      </svg>
      <h1 className="font-display text-2xl font-bold text-text-primary">{t("title")}</h1>
      <div className="max-w-sm space-y-3 text-text-secondary">
        <p>{t("body")}</p>
        <p className="text-sm text-text-tertiary">{t("safe")}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <RetryButton label={t("retry")} homeHref={`/${locale}`} />
        <KButton asChild variant="secondary">
          <a href={`/${locale}`}>{t("home")}</a>
        </KButton>
      </div>
    </main>
  );
}
