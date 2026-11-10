import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LoginPage } from "./LoginPage";

interface LoginRouteProps {
  params: Promise<{ locale: string }>;
}

/**
 * Metadatos traducidos (TXT-5) y fuera del índice (SEO-6): el login no es una
 * página de aterrizaje. El canonical va sin `?mode=` ni `?next=` para que
 * todas las variantes cuenten como una.
 */
export async function generateMetadata({ params }: LoginRouteProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  const title = t("metaTitle");
  const description = t("metaDescription");
  const path = `/${locale}/login`;
  return {
    title,
    description,
    robots: { index: false, follow: true },
    alternates: {
      canonical: path,
      languages: { es: "/es/login", en: "/en/login" },
    },
    // Next sustituye (no fusiona) el `openGraph` del layout: se repiten
    // `siteName` y `type`.
    openGraph: {
      siteName: "KULTURA",
      type: "website",
      title,
      description,
      url: path,
      locale: locale === "en" ? "en_US" : "es_ES",
    },
  };
}

export default async function LoginRoute({ params }: LoginRouteProps) {
  const { locale } = await params;

  return (
    <Suspense>
      <LoginPage locale={locale} />
    </Suspense>
  );
}
