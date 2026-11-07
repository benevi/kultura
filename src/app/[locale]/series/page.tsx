import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { WedgePage, wedgeMetadata } from "@/components/landing/wedge-page";

// F1 · prueba de humo (D2): mini-landing de la cuña «series». Sale del CDN
// (`STATIC_CSP_ROUTES`), un HTML por idioma, regenerado cada día como la portada.
export const revalidate = 86400;

interface Props {
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props) {
  return wedgeMetadata("series", (await params).locale);
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale === "en" ? "en" : "es");
  return <WedgePage wedge="series" rawLocale={locale} />;
}
