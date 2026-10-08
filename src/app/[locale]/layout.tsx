import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { preconnect } from "react-dom";
import { routing } from "@/i18n/routing";
import "../globals.css";

const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
  display: "swap",
});


const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kultura.app'

export const metadata: Metadata = {
  title: {
    template: "%s · KULTURA",
    default: "KULTURA — Descubre tu cultura",
  },
  description:
    "Descubre, registra y comparte películas, series, anime, libros, cómics, manga y videojuegos.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    siteName: 'KULTURA',
    type: 'website',
    locale: 'es_ES',
    title: 'KULTURA — Descubre tu cultura',
    description: 'Descubre, registra y comparte películas, series, anime, libros, cómics, manga y videojuegos.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KULTURA — Descubre tu cultura',
    description: 'Descubre, registra y comparte películas, series, anime, libros, cómics, manga y videojuegos.',
  },
};

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

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "es" | "en")) {
    notFound();
  }

  const messages = await getMessages();

  // Sin crossOrigin: las <img> se piden en modo no-cors y usan otra conexión.
  for (const origin of POSTER_CDNS) preconnect(origin);

  return (
    <html lang={locale}>
      <body
        className={`${bricolageGrotesque.variable} ${figtree.variable} font-body bg-surface-base text-text-primary antialiased grain`}
      >
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
