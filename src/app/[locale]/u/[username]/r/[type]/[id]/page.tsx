// ============================================================
// KULTURA — /u/[username]/r/[type]/[id] (CRE-8a, F-29) · PÚBLICA
// "benevi le da 9/10 a Dune": la nota de una persona sobre un título, para
// compartir. Qué se enseña y a quién lo decide `resolveRatingShare` (ver su
// cabecera): con la nota solo a quien puede verla o trae el enlace firmado
// del dueño; a los demás, la misma página GENÉRICA (título + perfil, sin
// nota). Nunca indexable (página personal).
//
// Tarjeta de compartir: la genérica (`opengraph-image`) o la firmada
// (`card/[firma]`, route handler). Los metadatos fijan `images` SIEMPRE a mano,
// también vacío en el 404 y si algo falla (los de página mandan sobre los del
// archivo): la firma solo sale en el HTML de quien ya trae una firma válida.
// ============================================================

import * as React from "react";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { KButton } from "@/components/ui/KButton";
import { Avatar } from "@/components/ui/Avatar";
import { PosterImage } from "@/components/media/PosterImage";
import { SignedInBar, SignUpCta } from "@/components/collection/PublicCollection";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { posterGradient } from "@/lib/images/poster-gradient";
import { mediaPath } from "@/lib/media/seo";
import { parseMediaId } from "@/lib/media/media-id";
import { siteUrl } from "@/lib/site-url";
import { resolveRenamedUsername } from "@/lib/social/public-collection";
import { parseAttributionRecord, withAttribution, type AttributionParams } from "@/lib/analytics/attribution";
import { OG_LOCALE, SITE_NAME } from "@/i18n/metadata";
import {
  SHARE_SIG_PARAM,
  ratingPagePath,
  resolveRatingShare,
  splitRich,
  type RatingShareView,
  type ShareViewer,
} from "../../_lib/rating-share";

type SearchParams = Record<string, string | string[] | undefined>;

interface Props {
  params: Promise<{ locale: string; username: string; type: string; id: string }>;
  searchParams?: Promise<SearchParams>;
}

const dedupe: <T extends (...args: never[]) => unknown>(fn: T) => T =
  (React as unknown as { cache?: <T>(fn: T) => T }).cache ?? ((fn) => fn);

function decode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Quién mira (sin sesión: `null`; nunca lanza). */
const currentViewer = dedupe(async (): Promise<ShareViewer | null> => {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user ? { id: data.user.id, supabase } : null;
  } catch {
    return null;
  }
});

/** Una resolución por petición (metadatos y página). */
const resolveView = dedupe(
  async (locale: string, username: string, type: string, id: string, sig: string | undefined): Promise<RatingShareView> =>
    resolveRatingShare({ username, type, externalId: id, locale, sig, viewer: await currentViewer() })
);

async function load(props: Props) {
  const { locale, username, type, id } = await props.params;
  const sp = (await props.searchParams) ?? {};
  const name = decode(username);
  const externalId = decode(id);
  const sig = first(sp[SHARE_SIG_PARAM]);
  const view = await resolveView(locale, name, type, externalId, sig);
  return { locale, name, type, externalId, sp, sig, view };
}

/**
 * URL absoluta de la tarjeta. La firmada SOLO si la petición trae una firma
 * válida para este dueño y título (`view.signed`) y la nota se ve: es la misma
 * firma que ya tiene quien mira, nunca una nueva.
 */
function ogImageUrl(locale: string, view: Extract<RatingShareView, { kind: "rated" | "generic" }>, sig?: string) {
  const base = `${siteUrl()}/${locale}${ratingPagePath(view.owner.username, view.parsed.type, view.parsed.externalId)}`;
  if (view.kind === "rated" && view.signed && sig) return `${base}/card/${encodeURIComponent(sig)}?v=${view.rating.rating10}`;
  if (view.kind === "rated" && view.publicWithoutSignature) return `${base}/opengraph-image?v=${view.rating.rating10}`;
  return `${base}/opengraph-image`;
}

const ROBOTS = { index: false, follow: true };

/** Sin título o con un fallo: nada de tarjeta (ni la que Next deduciría de los archivos). */
const NO_CARD: Metadata = {
  title: SITE_NAME,
  robots: ROBOTS,
  openGraph: { images: [] },
  twitter: { images: [] },
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  try {
    return await buildMetadata(props);
  } catch {
    return NO_CARD;
  }
}

async function buildMetadata(props: Props): Promise<Metadata> {
  const { locale, view, sig } = await load(props);
  if (view.kind === "not_found") return NO_CARD;
  const t = await getTranslations({ locale, namespace: "share" });

  const values = { username: view.owner.username, title: view.media.title };
  const rated = view.kind === "rated";
  const title = rated
    ? t("page.metaTitle", { ...values, rating: view.rating.text })
    : t("page.genericMetaTitle", values);
  const description = rated ? t("page.metaDescription", values) : t("page.genericLead", values);
  // La tarjeta lleva la nota solo en sus variantes visibles sin cuenta.
  const cardHasRating = rated && ((view.signed && Boolean(sig)) || view.publicWithoutSignature);
  const image = {
    url: ogImageUrl(locale, view, sig),
    width: 1200,
    height: 630,
    alt: cardHasRating
      ? t("og.ratedAlt", { ...values, rating: view.kind === "rated" ? view.rating.text : "" })
      : t("og.genericAlt", values),
  };
  const path = `/${locale}${ratingPagePath(view.owner.username, view.parsed.type, view.parsed.externalId)}`;
  return {
    title: `${title} · ${SITE_NAME}`,
    description,
    robots: ROBOTS,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: OG_LOCALE[locale === "en" ? "en" : "es"],
      title,
      description,
      images: [image],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/** Query original (atribución) para conservarla al redirigir un nombre antiguo. */
function queryString(sp: SearchParams): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    const v = first(value);
    if (typeof v === "string") params.set(key, v);
  }
  const q = params.toString();
  return q ? `?${q}` : "";
}

export default async function RatedTitlePage(props: Props) {
  const { locale, name, type, externalId, sp, view } = await load(props);
  if (view.kind === "not_found") {
    // R11: nombre antiguo → el actual, con la firma y la atribución. (La
    // firma va por el id del dueño, no por su nombre: sigue valiendo.)
    const parsed = parseMediaId(`${type}_${externalId}`);
    const current = parsed ? await resolveRenamedUsername(name).catch(() => null) : null;
    if (parsed && current) {
      permanentRedirect(`/${locale}${ratingPagePath(current, parsed.type, parsed.externalId)}${queryString(sp)}`);
    }
    notFound();
  }

  const [t, tc] = await Promise.all([
    getTranslations({ locale, namespace: "share" }),
    getTranslations({ locale, namespace: "media" }),
  ]);
  const viewer = await currentViewer();
  const { owner, media, parsed } = view;
  const values = { username: owner.username, title: media.title };
  const titleHref = `/media/${parsed.type}/${encodeURIComponent(parsed.externalId)}`;

  // D-12: el alta desde aquí se atribuye a quien compartió (sin firma de
  // invitación: no crea amistad) y vuelve a la ficha del título.
  const attribution = parseAttributionRecord(sp);
  const signup: AttributionParams = attribution.ref
    ? attribution
    : { ...attribution, ref: owner.username, channel: attribution.utm_source ? "utm" : "ref" };
  const next = encodeURIComponent(mediaPath(locale, parsed.type, parsed.externalId));
  const registerHref = withAttribution(`/login?mode=register&next=${next}`, signup);

  const heading =
    view.kind === "rated"
      ? splitRich(t.raw("page.heading") as string, { ...values, rating: view.rating.text })
      : splitRich(t.raw("page.genericHeading") as string, values);

  return (
    <div className="min-h-screen flex flex-col">
      {viewer ? <SignedInBar /> : <Header />}
      <main id="main" className="page-grid [&>*]:max-w-4xl flex-1 py-10 flex flex-col gap-10">
        <article
          className="rounded-bento-xl bg-surface-default p-6 md:p-10 shadow-hard-sm md:shadow-hard flex flex-col sm:flex-row gap-6 md:gap-10"
        >
          <div
            className="relative w-36 sm:w-44 md:w-52 aspect-[2/3] flex-shrink-0 rounded-2xl overflow-hidden self-center sm:self-start"
            style={{ background: posterGradient(parsed.id) }}
          >
            {media.poster ? (
              <PosterImage src={media.poster} sizes="(max-width: 640px) 144px, 208px" className="object-cover" priority />
            ) : (
              <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-white/90 font-display font-extrabold text-3xl">
                {media.title.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-5 min-w-0">
            <Link
              href={`/u/${encodeURIComponent(owner.username)}`}
              className="inline-flex items-center gap-2.5 self-start min-h-11 rounded-full pr-3 font-bold text-sm text-text-secondary hover:text-accent-pink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink"
            >
              <Avatar initials={owner.avatarInitials} color={owner.avatarColor} size="sm" />
              @{owner.username}
            </Link>

            <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-text-primary leading-tight">
              {heading.map((part, i) =>
                part.tag === "score" ? (
                  <span
                    key={i}
                    className="inline-block align-middle rounded-full bg-accent-lime text-on-accent-lime font-extrabold px-4 py-1 mx-1 -rotate-3 shadow-sticker"
                  >
                    {part.text}
                  </span>
                ) : part.tag === "work" ? (
                  <span key={i} className="text-accent-pink">
                    {part.text}
                  </span>
                ) : part.tag === "who" ? (
                  <span key={i}>{part.text}</span>
                ) : (
                  <React.Fragment key={i}>{part.text}</React.Fragment>
                )
              )}
            </h1>

            <p className="text-sm text-text-secondary">
              {tc(parsed.type)}
              {media.year ? ` · ${media.year}` : ""}
            </p>

            {view.kind === "generic" ? (
              <p className="text-body text-text-secondary leading-relaxed max-w-prose">{t("page.genericLead", values)}</p>
            ) : null}

            <div className="flex flex-wrap gap-2.5">
              <KButton asChild size="lg">
                <Link href={titleHref}>{viewer ? t("page.ctaRate") : t("page.viewTitle")}</Link>
              </KButton>
              <KButton asChild variant="secondary" size="lg">
                <Link href={`/u/${encodeURIComponent(owner.username)}`}>{t("page.viewProfile", values)}</Link>
              </KButton>
            </div>

            {view.kind === "rated" && view.isOwner ? (
              <p className="text-meta text-text-tertiary leading-relaxed max-w-prose">{t("page.ownerHint")}</p>
            ) : null}
          </div>
        </article>

        {!viewer ? <SignUpCta href={registerHref} /> : null}
      </main>
      <Footer />
    </div>
  );
}
