import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { bricolageGrotesque, figtree } from "@/app/fonts";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { preconnect } from "react-dom";
import { Analytics } from "@vercel/analytics/next";
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
  // `x-pathname` lo pone siempre el middleware (ruta real, sin lo que mande
  // el cliente); da el `og:url` de las páginas que no definen el suyo. Las
  // páginas ya son dinámicas por el nonce de la CSP: leer la cabecera no
  // cambia eso (si algún día se sirven estáticas, sale de aquí).
  return shellMetadata(locale, headers().get("x-pathname"));
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

  const [messages, t] = await Promise.all([
    getMessages(),
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
        <Analytics />
      </body>
    </html>
  );
}
