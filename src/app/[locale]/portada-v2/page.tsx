import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site-url";
import { PortadaScreen } from "@/v2/portada/PortadaScreen";
import type { Metadata } from "next";

// ============================================================
// KULTURA — Portada v2 «Láminas» (fuera de servicio, D-H2)
//
// La portada es siempre la landing, también con la UI v2: el middleware ya no
// reescribe aquí y el acceso directo da 404 (`src/middleware.ts`). El código
// se queda hasta la limpieza de la UI vieja (regla 3).
// ============================================================

interface Props {
  params: Promise<{ locale: string }>;
}

// Cada hora: si se generó con proveedores caídos, no se queda un día con el respaldo.
export const revalidate = 3600;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = (await params).locale === "en" ? "en" : "es";
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "portada" });
  const base = siteUrl();
  const url = `${base}/${locale}`;
  return {
    title: { absolute: t("seo.title") },
    description: t("seo.description"),
    alternates: {
      canonical: url,
      languages: { es: `${base}/es`, en: `${base}/en`, "x-default": `${base}/es` },
    },
    openGraph: {
      title: t("seo.title"),
      description: t("seo.description"),
      url,
      siteName: "KULTURA",
      type: "website",
      locale: locale === "en" ? "en_US" : "es_ES",
      alternateLocale: locale === "en" ? ["es_ES"] : ["en_US"],
    },
    twitter: { card: "summary_large_image", title: t("seo.title"), description: t("seo.description") },
  };
}

export default async function PortadaV2Page({ params }: Props) {
  const locale = (await params).locale === "en" ? "en" : "es";
  setRequestLocale(locale);
  return <PortadaScreen locale={locale} />;
}
