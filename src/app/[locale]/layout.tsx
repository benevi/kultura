import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import "../globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
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

  return (
    <html lang={locale}>
      <body
        className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} font-body bg-surface-base text-text-primary antialiased grain`}
      >
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
