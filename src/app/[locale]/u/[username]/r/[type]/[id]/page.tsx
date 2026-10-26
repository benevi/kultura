// ============================================================
// KULTURA — /u/[username]/r/[type]/[id] (CRE-8a, F-29) · PÚBLICA
// "benevi le da 9/10 a Dune": la nota de una persona sobre un título, para
// compartir. Qué se enseña y a quién lo decide `resolveRatingShare` (ver su
// cabecera): con la nota solo a quien puede verla o trae el enlace firmado
// del dueño; a los demás, la misma página GENÉRICA (título + perfil, sin
// nota). Nunca indexable (página personal).
//
// Tarjeta de compartir: `opengraph-image` con dos variantes, la genérica
// (`card`) y la firmada (id = firma). Los metadatos la fijan SIEMPRE a mano
// (los de página mandan sobre los del archivo), así la firma solo sale en el
// HTML de quien ya vino con ella.
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

/** URL absoluta de la tarjeta: la firmada solo si quien mira ya traía la firma. */
function ogImageUrl(locale: string, view: Extract<RatingShareView, { kind: "rated" | "generic" }>, sig?: string) {
  const base = `${siteUrl()}/${locale}${ratingPagePath(view.owner.username, view.parsed.type, view.parsed.externalId)}/opengraph-image`;
  if (view.kind === "rated" && view.signed && sig) return `${base}/${sig}?v=${view.rating.rating10}`;
  if (view.kind === "rated" && view.publicWithoutSignature) return `${base}/card?v=${view.rating.rating10}`;
  return `${base}/card`;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale, view, sig } = await load(props);
  const t = await getTranslations({ locale, namespace: "share" });
  const robots = { index: false, follow: true };
  if (view.kind === "not_found") return { title: SITE_NAME, robots };

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
    robots,
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
      <main id="main" className="flex-1 w-full max-w-4xl mx-auto px-4 md:px-8 py-10 flex flex-col gap-10">
        <article
          className="rounded-bento-xl bg-surface-default p-6 md:p-10 shadow-[6px_6px_0_var(--surface-elevated)] md:shadow-[10px_10px_0_var(--surface-elevated)] flex flex-col sm:flex-row gap-6 md:gap-10"
        >
          <div
            className="relative w-36 sm:w-44 md:w-52 aspect-[2/3] flex-shrink-0 rounded-18 overflow-hidden self-center sm:self-start"
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
                    className="inline-block align-middle rounded-full bg-accent-lime text-on-accent-lime font-extrabold px-4 py-1 mx-1 -rotate-3 shadow-[4px_4px_0_rgba(0,0,0,.4)]"
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
              <p className="text-[15px] text-text-secondary leading-relaxed max-w-prose">{t("page.genericLead", values)}</p>
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
              <p className="text-[13px] text-text-tertiary leading-relaxed max-w-prose">{t("page.ownerHint")}</p>
            ) : null}
          </div>
        </article>

        {!viewer ? <SignUpCta href={registerHref} /> : null}
      </main>
      <Footer />
    </div>
  );
}
