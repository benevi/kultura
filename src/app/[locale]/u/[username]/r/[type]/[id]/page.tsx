// ============================================================
// KULTURA — /u/[username]/r/[type]/[id]?s={firma} (PÚBLICA, F-29)
// "benevi le da 9/10 a Dune": la nota de alguien sobre un título, para
// compartir. Solo con la firma que genera "Compartir mi nota" (ver
// `_lib/share.ts`); sin ella, a la ficha del título. Fuera del índice
// siempre: es contenido de una persona, no del catálogo. La tarjeta OG la
// pinta `card/route.tsx` (lleva la firma en la query, que el archivo
// `opengraph-image` no recibe).
// ============================================================

import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { KButton } from "@/components/ui/KButton";
import { PosterImage } from "@/components/media/PosterImage";
import { Link } from "@/i18n/navigation";
import { loadMediaDetail } from "@/lib/media/detail-data";
import { parseMediaId } from "@/lib/media/media-id";
import { mediaPath } from "@/lib/media/seo";
import { siteUrl } from "@/lib/site-url";
import { formatRating10, loadSharedRating } from "../../_lib/share";

type SearchParams = Record<string, string | string[] | undefined>;

interface Props {
  params: Promise<{ locale: string; username: string; type: string; id: string }>;
  searchParams?: Promise<SearchParams>;
}

function decode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function resolve({ params, searchParams }: Props) {
  const { locale, username: rawUser, type, id: rawId } = await params;
  const sp = (await searchParams) ?? {};
  const username = decode(rawUser);
  const id = decode(rawId);
  const parsed = parseMediaId(`${type}_${id}`);
  const sig = first(sp.s) ?? null;
  return { locale, username, type, id, parsed, sig };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale, username, type, id, parsed, sig } = await resolve(props);
  const t = await getTranslations({ locale, namespace: "share" });
  const robots = { index: false, follow: true };
  if (!parsed) return { title: t("notFound"), robots };
  const [shared, detail] = await Promise.all([
    loadSharedRating(username, parsed.id, sig),
    loadMediaDetail(type, id, locale),
  ]);
  if (!shared || !detail) return { title: detail?.item.title ?? t("notFound"), robots };

  const title = t("headline", {
    username: shared.owner.username,
    rating: formatRating10(shared.rating10, locale),
    title: detail.item.title,
  });
  const description = t("metaDescription", { username: shared.owner.username });
  const path = `/${locale}/u/${encodeURIComponent(shared.owner.username)}/r/${parsed.type}/${encodeURIComponent(parsed.externalId)}`;
  const image = { url: `${siteUrl()}${path}/card?s=${sig}`, width: 1200, height: 630, alt: title };
  return {
    title,
    description,
    robots,
    alternates: { canonical: `${path}?s=${sig}` },
    openGraph: {
      type: "article",
      siteName: "KULTURA",
      locale: locale === "en" ? "en_US" : "es_ES",
      url: `${siteUrl()}${path}?s=${sig}`,
      title,
      description,
      images: [image],
    },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

export default async function SharedRatingPage(props: Props) {
  const { locale, username, type, id, parsed, sig } = await resolve(props);
  if (!parsed) notFound();
  const [shared, detail] = await Promise.all([
    loadSharedRating(username, parsed.id, sig),
    loadMediaDetail(type, id, locale),
  ]);
  if (!detail) notFound();
  // Sin firma válida (o ya sin nota): nada de nadie, solo el título.
  if (!shared) redirect(mediaPath(locale, parsed.type, parsed.externalId));

  const { item } = detail;
  const [t, tMedia] = await Promise.all([
    getTranslations({ locale, namespace: "share" }),
    getTranslations({ locale, namespace: "media" }),
  ]);
  const owner = shared.owner.username;
  const rating = formatRating10(shared.rating10, locale);
  const fichaHref = `/media/${item.type}/${encodeURIComponent(item.externalId)}`;
  const next = encodeURIComponent(mediaPath(locale, item.type, item.externalId));

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main" className="flex-1 w-full max-w-3xl mx-auto px-4 md:px-8 py-10">
        <article className="flex flex-col sm:flex-row gap-6 sm:gap-10 items-start">
          <div className="relative w-[180px] sm:w-[240px] aspect-[2/3] flex-shrink-0 rounded-[24px] overflow-hidden bg-surface-elevated">
            <div
              aria-hidden="true"
              className="absolute inset-0 flex items-center justify-center text-text-tertiary font-display font-extrabold text-3xl"
            >
              {item.title.slice(0, 2).toUpperCase()}
            </div>
            {item.poster && <PosterImage src={item.poster} sizes="240px" className="object-cover" priority />}
          </div>
          <div className="flex flex-col gap-4 min-w-0">
            <p className="text-sm font-bold uppercase tracking-wide text-text-tertiary">
              {tMedia(item.type as Parameters<typeof tMedia>[0])}
              {item.year ? ` · ${item.year}` : ""}
            </p>
            <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-text-primary">
              {t("headline", { username: owner, rating, title: item.title })}
            </h1>
            <p aria-hidden="true" className="font-display text-6xl font-extrabold text-accent-lime leading-none">
              {rating}
              <span className="text-2xl text-text-secondary">/10</span>
            </p>
            <div className="flex flex-wrap gap-2.5 mt-2">
              <KButton asChild variant="primary" size="sm">
                <Link href={fichaHref}>{t("viewTitle")}</Link>
              </KButton>
              <KButton asChild variant="secondary" size="sm">
                <Link href={`/u/${encodeURIComponent(owner)}`}>{t("viewProfile", { username: owner })}</Link>
              </KButton>
            </div>
            <p className="text-sm text-text-secondary">
              {t("joinHint")}{" "}
              <Link
                href={`/login?mode=register&ref=${encodeURIComponent(owner)}&next=${next}`}
                rel="nofollow"
                className="font-bold text-text-primary underline underline-offset-2 hover:text-accent-pink"
              >
                {t("join")}
              </Link>
            </p>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
