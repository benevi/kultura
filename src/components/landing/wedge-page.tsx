// ============================================================
// KULTURA — Página y metadatos de una mini-landing de cuña (F1, D2)
//
// Lo comparten `/[locale]/series` y `/[locale]/anime`. Ruta estática para el
// CDN (`STATIC_CSP_ROUTES`): sin cookies ni `searchParams`; la UTM la añade
// en el navegador la isla del CTA. `noindex` mientras dure la prueba: no
// compite con la portada en buscadores ni deja URL que luego haya que retirar.
// ============================================================

import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { kulturaDisplay } from "@/app/fonts";
import { renderDataAttribution } from "@/components/legal/DataAttribution";
import { getLandingMedia } from "@/lib/landing/media";
import { buildLandingScenes } from "@/lib/landing/scenes";
import { pickWedgePoster } from "@/lib/landing/wedge";
import { siteUrl } from "@/lib/site-url";
import type { Wedge } from "@/lib/analytics/attribution";
import { WedgeLanding, type WedgeCopy } from "./WedgeLanding";

type Locale = "es" | "en";
const asLocale = (raw: string): Locale => (raw === "en" ? "en" : "es");

type T = Awaited<ReturnType<typeof getTranslations<"landing.wedge">>>;

/**
 * Textos de cada cuña con claves literales (no `${wedge}.title`): así los
 * tests de i18n (`missing-messages`, `dead-keys`) pueden comprobarlas.
 */
function wedgeText(t: T, wedge: Wedge) {
  return wedge === "series"
    ? {
        seoTitle: t("series.seo.title"),
        seoDescription: t("series.seo.description"),
        title: t("series.title"),
        lead: t("series.lead"),
        points: [t("series.points.one"), t("series.points.two"), t("export")],
      }
    : {
        seoTitle: t("anime.seo.title"),
        seoDescription: t("anime.seo.description"),
        title: t("anime.title"),
        lead: t("anime.lead"),
        points: [t("anime.points.one"), t("anime.points.two"), t("export")],
      };
}

export async function wedgeMetadata(wedge: Wedge, rawLocale: string): Promise<Metadata> {
  const l = asLocale(rawLocale);
  setRequestLocale(l);
  const text = wedgeText(await getTranslations({ locale: l, namespace: "landing.wedge" }), wedge);
  const title = text.seoTitle;
  const description = text.seoDescription;
  const base = siteUrl();
  const url = `${base}/${l}/${wedge}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url, languages: { es: `${base}/es/${wedge}`, en: `${base}/en/${wedge}` } },
    robots: { index: false, follow: true },
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

export async function WedgePage({ wedge, rawLocale }: { wedge: Wedge; rawLocale: string }) {
  const locale = asLocale(rawLocale);
  setRequestLocale(locale);
  const [t, tl, tland, tn, media] = await Promise.all([
    getTranslations({ locale, namespace: "landing.wedge" }),
    getTranslations({ locale, namespace: "legal" }),
    getTranslations({ locale, namespace: "landing" }),
    getTranslations({ locale, namespace: "nav" }),
    getLandingMedia(),
  ]);
  const poster = pickWedgePoster(buildLandingScenes(media), wedge);
  const text = wedgeText(t, wedge);
  const other: Locale = locale === "es" ? "en" : "es";

  const copy: WedgeCopy = {
    locale,
    login: tland("nav.login"),
    navLabel: tland("nav.label"),
    title: text.title,
    lead: text.lead,
    points: text.points,
    cta: tland("hero.cta"),
    footerNav: tn("footerNav"),
    links: [
      { href: "/privacy", text: tl("nav.privacy") },
      { href: "/terms", text: tl("nav.terms") },
      { href: "/legal", text: tl("nav.notice") },
      { href: "/accessibility", text: tl("nav.accessibility") },
    ],
    otherLocale: { href: `/${other}/${wedge}`, text: tland("footer.otherLocale"), lang: other },
    attribution: await renderDataAttribution(),
  };

  return (
    <div className={kulturaDisplay.variable}>
      <WedgeLanding wedge={wedge} poster={poster} copy={copy} base={`/${locale}`} />
    </div>
  );
}
