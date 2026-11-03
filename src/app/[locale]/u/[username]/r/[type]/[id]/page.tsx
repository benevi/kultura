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
import { Footer } from "@/components/layout/Footer";
import { KButton } from "@/components/ui/KButton";
import { Avatar } from "@/components/ui/Avatar";
import { AlbumPage } from "@/components/album/AlbumPage";
import { Cromo } from "@/components/album/Cromo";
import { FormatTag } from "@/components/album/FormatTag";
import { getAlbumLabels } from "@/components/album/labels.server";
import { PublicBar, SignUpCta } from "@/components/collection/PublicCollection";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { isFoil } from "@/lib/design/album";
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

/**
 * La nota en la caja amarilla del álbum: la cifra grande en Lilita y la
 * escala al lado («9 /10», «4,5 /5»). Decorativa: la nota está escrita en
 * el titular, que es lo que lee el lector de pantalla.
 */
function bigScore(rating: { rating10: number; scale: string; text: string }, locale: string) {
  const fmt = new Intl.NumberFormat(locale === "en" ? "en" : "es", { maximumFractionDigits: 1 });
  if (rating.scale === "ten") return { main: fmt.format(rating.rating10), suffix: "/10" };
  if (rating.scale === "stars") return { main: fmt.format(rating.rating10 / 2), suffix: "/5" };
  return { main: rating.text.replace(/[^\d.,]/g, ""), suffix: "/5" };
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

  const [t, album] = await Promise.all([
    getTranslations({ locale, namespace: "share" }),
    getAlbumLabels(locale),
  ]);
  const viewer = await currentViewer();
  const { owner, media, parsed } = view;
  const values = { username: owner.username, title: media.title };
  const titleHref = `/media/${parsed.type}/${encodeURIComponent(parsed.externalId)}`;
  const profileHref = `/u/${encodeURIComponent(owner.username)}`;
  const pagePath = `/${locale}${ratingPagePath(owner.username, parsed.type, parsed.externalId)}`;

  // D-12: el alta desde aquí se atribuye a quien compartió (sin firma de
  // invitación: no crea amistad) y vuelve a la ficha del título.
  const attribution = parseAttributionRecord(sp);
  const signup: AttributionParams = attribution.ref
    ? attribution
    : { ...attribution, ref: owner.username, channel: attribution.utm_source ? "utm" : "ref" };
  const next = encodeURIComponent(mediaPath(locale, parsed.type, parsed.externalId));
  const registerHref = withAttribution(`/login?mode=register&next=${next}`, signup);

  const rated = view.kind === "rated" ? view : null;
  const heading = rated
    ? splitRich(t.raw("page.heading") as string, { ...values, rating: rated.rating.text })
    : splitRich(t.raw("page.genericHeading") as string, values);
  const score = rated ? bigScore(rated.rating, locale) : null;
  const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

  return (
    <AlbumPage as="div" contained={false} className="flex min-h-screen flex-col">
      <PublicBar locale={locale} signedIn={Boolean(viewer)} returnTo={pagePath} />
      <main id="main" className="flex-1">
        <AlbumPage as="article" tone="cyan" className="border-b-2 border-album-navy">
          <div className="flex flex-col gap-8 py-8 sm:flex-row sm:items-end md:gap-12 md:py-14">
            {/* El cromo manda: es lo más grande de la pantalla. 10/10 = brillante. */}
            <div className="relative w-44 shrink-0 sm:w-56 md:w-72">
              <Cromo
                seed={parsed.id}
                title={media.title}
                poster={media.poster}
                sizes="(max-width: 640px) 176px, 288px"
                priority
                still
                foil={rated ? isFoil(rated.rating.rating10) : false}
                stateLabel={rated && isFoil(rated.rating.rating10) ? album.foil() : undefined}
              />
              {score ? (
                <span
                  aria-hidden="true"
                  className="absolute -bottom-4 -right-6 inline-flex items-baseline gap-0.5 rounded-cromo border-2 border-album-navy bg-album-yellow px-3 py-2 text-album-ink md:-right-8"
                >
                  <span className="font-numeral text-6xl leading-none md:text-7xl">{score.main}</span>
                  <span className="font-numeral text-2xl leading-none">{score.suffix}</span>
                </span>
              ) : null}
            </div>

            <div className="flex min-w-0 flex-col gap-5">
              <Link
                href={profileHref}
                className={`inline-flex min-h-11 items-center gap-2.5 self-start rounded-lg text-sm font-bold text-text-primary underline-offset-4 hover:underline ${FOCUS}`}
              >
                <Avatar
                  initials={owner.avatarInitials}
                  color={owner.avatarColor}
                  size="sm"
                  className="rounded-cromo border-2 border-album-white"
                />
                @{owner.username}
              </Link>

              <h1 className="break-words font-display text-3xl text-text-primary text-balance [overflow-wrap:anywhere] md:text-5xl">
                {heading.map((part, i) =>
                  part.tag === "score" ? (
                    <span key={i} className="whitespace-nowrap rounded-cromo bg-album-yellow px-2 text-album-ink">
                      {part.text}
                    </span>
                  ) : (
                    <React.Fragment key={i}>{part.text}</React.Fragment>
                  )
                )}
              </h1>

              <p className="flex flex-wrap items-center gap-x-3 text-sm font-semibold text-text-primary">
                <FormatTag format={parsed.type} label={album.format(parsed.type)} className="text-sm text-text-primary" />
                {media.year ? <span className="tabular-nums">{media.year}</span> : null}
              </p>

              {view.kind === "generic" ? (
                <p className="max-w-prose text-base text-text-primary">{t("page.genericLead", values)}</p>
              ) : null}

              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                {viewer ? (
                  <KButton asChild size="lg">
                    <Link href={titleHref}>{t("page.ctaRate")}</Link>
                  </KButton>
                ) : (
                  <KButton asChild variant="secondary" size="lg">
                    <Link href={titleHref}>{t("page.viewTitle")}</Link>
                  </KButton>
                )}
                <Link
                  href={profileHref}
                  className={`inline-flex min-h-11 items-center rounded-lg text-sm font-bold text-text-primary underline underline-offset-4 ${FOCUS}`}
                >
                  {t("page.viewProfile", values)}
                </Link>
              </div>

              {rated && rated.isOwner ? (
                <p className="max-w-prose text-meta text-text-primary">{t("page.ownerHint")}</p>
              ) : null}
            </div>
          </div>
        </AlbumPage>
      </main>
      {!viewer ? <SignUpCta href={registerHref} label={t("page.ctaRegister")} /> : null}
      <Footer />
    </AlbumPage>
  );
}
