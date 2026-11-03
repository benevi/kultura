import { Suspense } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { LoginPage } from "./LoginPage";
import { detectInAppBrowser } from "./in-app-browser";
import { SobreStage } from "./SobreStage";
import { SobreWall } from "./SobreWall";

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

/**
 * La tapa del álbum. El navegador integrado se detecta ya aquí, por el user
 * agent, para que el HTML de Instagram o TikTok salga sin «Continuar con
 * Google» (MOV-11). El sobre con las portadas llega por su propio
 * `<Suspense>`: mientras tanto, los huecos vacíos del abanico.
 */
export default async function LoginRoute({ params }: LoginRouteProps) {
  const { locale } = await params;
  const inApp = detectInAppBrowser((await headers()).get("user-agent"));
  const wall = (
    <Suspense fallback={<SobreStage covers={[]} />}>
      <SobreWall locale={locale} />
    </Suspense>
  );

  return (
    <Suspense>
      <LoginPage locale={locale} inApp={inApp} wall={wall} />
    </Suspense>
  );
}
