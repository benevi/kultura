import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { kulturaDisplay } from "@/app/fonts";
import { Landing, COMPARE_FORMATS, type LandingCopy } from "@/components/landing/Landing";
import { renderDataAttribution } from "@/components/legal/DataAttribution";
import { bestYears } from "@/lib/best/best-of";
import { getLandingMedia } from "@/lib/landing/media";
import { RANKING_FORMATS, buildLandingScenes } from "@/lib/landing/scenes";
import { faqJsonLd, faqKeys, type FaqItem } from "@/lib/landing/faq";
import { env } from "@/lib/env.server";
import { siteUrl } from "@/lib/site-url";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ locale: string }>;
}

// D-02: la portada sale del CDN. Se pinta en el build (un HTML por idioma) y
// se regenera cada día, como la muestra de portadas y los rankings que enseña.
export const revalidate = 86400;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const l = locale === "en" ? "en" : "es";
  setRequestLocale(l);
  const t = await getTranslations({ locale: l, namespace: "landing" });
  // D-11: la misma promesa que el h1 en <title>, OG y la tarjeta de X.
  const title = t("seo.title");
  const description = t("seo.description");
  const base = siteUrl();
  const url = `${base}/${l}`;
  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: url,
      languages: { es: `${base}/es`, en: `${base}/en`, "x-default": `${base}/es` },
    },
    // Objeto completo: el de la página SUSTITUYE al del layout (no se mezcla),
    // así que `siteName` y `type` tienen que repetirse aquí. La imagen la pone
    // `opengraph-image.tsx` (y Next la copia a `twitter:image`).
    openGraph: {
      title,
      description,
      url,
      siteName: "KULTURA",
      type: "website",
      locale: l === "en" ? "en_US" : "es_ES",
      alternateLocale: l === "en" ? ["es_ES"] : ["en_US"],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function HomePage({ params }: Props) {
  const locale = (await params).locale === "en" ? "en" : "es";
  setRequestLocale(locale);
  const [t, tb, ts, tm, tl, tn, media] = await Promise.all([
    getTranslations({ locale, namespace: "landing" }),
    getTranslations({ locale, namespace: "best" }),
    getTranslations({ locale, namespace: "status" }),
    getTranslations({ locale, namespace: "media" }),
    getTranslations({ locale, namespace: "legal" }),
    getTranslations({ locale, namespace: "nav" }),
    getLandingMedia(),
  ]);
  // Imágenes de la semana; el hueco que falte usa el respaldo fijo.
  const scenes = buildLandingScenes(media);
  // E-DEMO: el botón solo existe si la cuenta demo está configurada.
  const demo = env.DEMO_USER_EMAIL ? t("hero.demo") : undefined;
  const [year] = bestYears();

  const faq: FaqItem[] = faqKeys(Boolean(demo)).map((key) => ({
    key,
    q: t(`faq.${key}.q`),
    a: t(`faq.${key}.a`),
  }));

  const other = locale === "es" ? "en" : "es";
  const copy: LandingCopy = {
    locale,
    nav: {
      label: t("nav.label"),
      features: t("nav.features"),
      rankings: t("nav.rankings"),
      faq: t("faq.title"),
      login: t("nav.login"),
    },
    hero: {
      lead: t("hero.lead"),
      cta: t("hero.cta"),
      demo,
      scenes: t("hero.scenes"),
      pause: t("hero.pause"),
      play: t("hero.play"),
    },
    features: {
      title: t("features.title"),
      items: (["library", "ai", "friends", "lists"] as const).map((k) => ({
        title: t(`features.${k}`),
        desc: t(`features.${k}Desc`),
      })),
      hold: t("features.hold"),
      holdLabel: t("features.holdLabel"),
      friendNow: t.raw("features.friendNow") as string,
    },
    how: {
      title: t("how.title"),
      steps: (["find", "track", "share"] as const).map((k) => ({
        title: t(`how.steps.${k}.title`),
        desc: t(`how.steps.${k}.desc`),
      })),
      status: ts("completed"),
    },
    rankings: {
      title: t("rankings.title", { year }),
      sub: t("rankings.sub"),
      cta: t("rankings.cta"),
      year,
      label: Object.fromEntries(RANKING_FORMATS.map((f) => [f, tb(`chip.${f}`)])) as LandingCopy["rankings"]["label"],
      score: (score) => t("rankings.score", { score }),
    },
    compare: {
      title: t("compare.title"),
      sub: t("compare.sub"),
      app: t("compare.appHeader"),
      yes: t("compare.yes"),
      no: t("compare.no"),
      note: t("compare.note"),
      formats: Object.fromEntries(COMPARE_FORMATS.map((f) => [f, t(`formats.${f}`)])) as LandingCopy["compare"]["formats"],
      short: Object.fromEntries(COMPARE_FORMATS.map((f) => [f, t(`formatsShort.${f}`)])) as LandingCopy["compare"]["short"],
    },
    faq: { title: t("faq.title"), items: faq },
    footer: {
      nav: tn("footerNav"),
      links: [
        { href: "/privacy", text: tl("nav.privacy") },
        { href: "/terms", text: tl("nav.terms") },
        { href: "/legal", text: tl("nav.notice") },
        { href: "/accessibility", text: tl("nav.accessibility") },
      ],
      otherLocale: { href: `/${other}`, text: t("footer.otherLocale"), lang: other },
    },
    attribution: await renderDataAttribution(),
    typeLabel: Object.fromEntries(COMPARE_FORMATS.map((f) => [f, tm(f)])),
  };

  const base = siteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "KULTURA",
        url: `${base}/${locale}`,
        description: t("seo.description"),
        applicationCategory: "EntertainmentApplication",
        operatingSystem: "Web",
        inLanguage: locale,
        offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
      },
      faqJsonLd(faq),
    ],
  };

  return (
    <div className={kulturaDisplay.variable}>
      <Landing scenes={scenes} copy={copy} base={`/${locale}`} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </div>
  );
}
