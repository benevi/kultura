import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site-url";
import { PortadaScreen } from "@/v2/portada/PortadaScreen";
import type { Metadata } from "next";

// ============================================================
// KULTURA — Portada v2 (destino de un rewrite, no una URL pública)
//
// `/es` y `/en` son estáticas y salen del CDN: no pueden leer la cookie
// `ui_v2`. El middleware sí la lee, antes de la caché, y reescribe aquí sin
// cambiar la URL. El acceso directo a esta ruta da 404 (`src/middleware.ts`).
// ============================================================

interface Props {
  params: Promise<{ locale: string }>;
}

export const revalidate = 86400;

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
