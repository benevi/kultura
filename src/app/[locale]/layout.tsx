import type { Metadata, Viewport } from "next";
import { bricolageGrotesque, figtree } from "@/app/fonts";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { preconnect } from "react-dom";
import { VercelAnalytics } from "@/components/analytics/VercelAnalytics";
import { isAppLocale } from "@/i18n/detect";
import { SHELL_CLIENT_NAMESPACES, pickMessages } from "@/i18n/client-messages";
import { SHELL_VIEWPORT, shellMetadata } from "@/i18n/metadata";
import { SkipLink } from "./SkipLink";
import "../globals.css";

export const viewport: Viewport = SHELL_VIEWPORT;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // Primer segmento que no es un idioma (`/algo.php`): el layout da 404 al
  // pintar. Aquí NO se lanza `notFound()`: Next vuelve a leer los metadatos de
  // los layouts para la 404 y se quedaría sin `<title>`.
  if (!isAppLocale(locale)) return {};
  // D-02: sin leer cabeceras. Este layout envuelve las páginas cacheables en
  // el CDN y una sola llamada a `headers()` las volvería dinámicas a todas.
  // Por eso no hay `og:url` por defecto: cada página indexable define el suyo
  // (portada, rankings, legales, perfiles, fichas y login).
  setRequestLocale(locale);
  return shellMetadata(locale);
}

/**
 * CDN de portadas que se piden DIRECTAS al proveedor (E-PORTADAS-RAPIDAS,
 * ver `posterLoader`): abrir la conexión (DNS + TLS) mientras llega el HTML
 * ahorra ese viaje a la primera portada de cada proveedor.
 */
const POSTER_CDNS = [
  "https://image.tmdb.org",
  "https://media.rawg.io",
  "https://s4.anilist.co",
  "https://cdn.myanimelist.net",
  "https://covers.openlibrary.org",
];

/**
 * Raíz HTML de la app (SEO-5/ACC-15): el único `<html>`, con el idioma de la
 * URL. `src/app/layout.tsx` solo pasa los hijos; la 404 y el error global de
 * fuera de `/[locale]` pintan su propio documento.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  // D-02: el idioma sale de la URL, no de la cabecera de next-intl, para que
  // las páginas estáticas puedan pintarse sin petición (las que lo son llaman
  // también a `setRequestLocale` y declaran `generateStaticParams`; las demás
  // siguen siendo dinámicas por sus propias cookies o parámetros).
  setRequestLocale(locale);

  const [messages, t] = await Promise.all([
    getMessages({ locale }),
    getTranslations({ locale, namespace: "meta" }),
  ]);

  // Sin crossOrigin: las <img> se piden en modo no-cors y usan otra conexión.
  for (const origin of POSTER_CDNS) preconnect(origin);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${bricolageGrotesque.variable} ${figtree.variable} font-body bg-surface-base text-text-primary antialiased grain`}
      >
        <SkipLink label={t("skipToContent")} />
        {/* REN-5: solo los textos de los componentes cliente de fuera de la
            zona con sesión; `(app)/template.tsx` añade los suyos. */}
        <NextIntlClientProvider messages={pickMessages(messages, SHELL_CLIENT_NAMESPACES)}>
          {children}
        </NextIntlClientProvider>
        {/* F-28: sin `?t=` (enlaces firmados del correo) en las páginas vistas. */}
        <VercelAnalytics />
      </body>
    </html>
  );
}
