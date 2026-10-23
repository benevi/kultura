import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { bricolageGrotesque, figtree } from "@/app/fonts";
import { NotFoundContent } from "@/components/ui/NotFoundContent";
import { localeFromAcceptLanguage } from "@/i18n/detect";
import { SHELL_VIEWPORT, SITE_NAME } from "@/i18n/metadata";

/**
 * 404 de fuera de `/[locale]` (rutas que no pasan por el middleware, p. ej.
 * `/algo.php`). El layout raíz no pinta documento, así que este sí, con el
 * idioma que pide el navegador (TXT-4) y las mismas fuentes que la app.
 */

export const viewport: Viewport = SHELL_VIEWPORT;

function requestLocale() {
  return localeFromAcceptLanguage(headers().get("accept-language"));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: requestLocale(), namespace: "errors" });
  return { title: `${t("notFoundTitle")} · ${SITE_NAME}`, robots: { index: false } };
}

export default async function RootNotFound() {
  const locale = requestLocale();
  const t = await getTranslations({ locale, namespace: "errors" });

  return (
    <html lang={locale}>
      <body
        className={`${bricolageGrotesque.variable} ${figtree.variable} font-body bg-surface-base text-text-primary antialiased`}
      >
        <NotFoundContent
          title={t("notFoundTitle")}
          description={t("notFoundDescription")}
          goHome={t("goHome")}
          homeHref={`/${locale}`}
        />
      </body>
    </html>
  );
}
