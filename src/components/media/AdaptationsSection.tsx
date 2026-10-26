// ============================================================
// KULTURA — "También existe como…" y franquicia en la ficha (F-29)
// Server Component async. Va dentro de un <Suspense fallback={null}> (lo pone
// la página): Wikidata nunca retrasa la ficha. Sin datos, no pinta nada.
// ============================================================

import { getTranslations } from "next-intl/server";
import type { MediaItem } from "@/types/media";
import { Link } from "@/i18n/navigation";
import { KButton } from "@/components/ui/KButton";
import { createClient } from "@/lib/supabase/server";
import { getAdaptations } from "@/lib/adaptations/load";
import { buildView, type AdaptationLink } from "@/lib/adaptations/model";
import { loadInLibrary, loadPosters } from "@/lib/adaptations/enrich";
import { mediaPath } from "@/lib/media/seo";
import { PosterImage } from "./PosterImage";
import { AddFranchiseButton } from "./AddFranchiseButton";

interface Props {
  item: Pick<MediaItem, "id" | "type" | "externalId">;
  locale: string;
  /** Slug de RAWG (juegos): Wikidata guarda el slug, no el id numérico. */
  rawgSlug?: string;
  /** Con sesión: para no volver a añadir lo que ya está en la biblioteca. */
  userId?: string | null;
}

const sectionTitle = "font-display text-xl font-bold text-text-primary mb-3";

function Tile({ link, typeLabel, relLabel }: { link: AdaptationLink; typeLabel: string; relLabel?: string }) {
  return (
    <li className="w-[132px] flex-shrink-0">
      <Link
        href={`/media/${link.type}/${encodeURIComponent(link.externalId)}`}
        className="group block rounded-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink"
      >
        <div className="relative aspect-[2/3] rounded-[16px] overflow-hidden bg-surface-elevated">
          <div
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-elevated to-surface-base text-text-tertiary font-display font-extrabold text-xl"
          >
            {link.title.slice(0, 2).toUpperCase()}
          </div>
          {link.poster && <PosterImage src={link.poster} sizes="132px" className="object-cover" />}
        </div>
        <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-text-tertiary">
          {typeLabel}
          {relLabel ? ` · ${relLabel}` : ""}
        </p>
        <p className="text-sm font-bold text-text-primary line-clamp-2 group-hover:text-accent-pink transition-colors">
          {link.title}
        </p>
        {link.year && <p className="text-xs text-text-secondary">{link.year}</p>}
      </Link>
    </li>
  );
}

export async function AdaptationsSection({ item, locale, rawgSlug, userId }: Props) {
  const stored = await getAdaptations(item.id, { rawgSlug });
  const view = buildView(stored, item.id, locale);
  if (view.alsoAs.length === 0 && !view.franchise) return null;

  const supabase = await createClient();
  const franchiseIds = view.franchise?.members.map((m) => m.mediaId) ?? [];
  const [posters, inLibrary, t, tMedia] = await Promise.all([
    loadPosters(supabase, [...view.alsoAs.map((l) => l.mediaId), ...franchiseIds]),
    userId ? loadInLibrary(supabase, userId, franchiseIds) : Promise.resolve(new Set<string>()),
    getTranslations({ locale, namespace: "adaptations" }),
    getTranslations({ locale, namespace: "media" }),
  ]);
  const withPoster = (l: AdaptationLink) => ({ ...l, poster: posters.get(l.mediaId) ?? null });
  const typeLabel = (l: AdaptationLink) => tMedia(l.type as Parameters<typeof tMedia>[0]);
  const relLabel = (l: AdaptationLink) => (l.rel === "source" ? t("rel.source") : undefined);
  const missing = franchiseIds.filter((id) => !inLibrary.has(id));
  const next = encodeURIComponent(mediaPath(locale, item.type, item.externalId));

  return (
    <div className="space-y-8">
      {view.alsoAs.length > 0 && (
        <section aria-labelledby="also-as-title">
          <h2 id="also-as-title" className={sectionTitle}>
            {t("title")}
          </h2>
          <ul className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {view.alsoAs.map((l) => (
              <Tile key={l.mediaId} link={withPoster(l)} typeLabel={typeLabel(l)} relLabel={relLabel(l)} />
            ))}
          </ul>
        </section>
      )}

      {view.franchise && (
        <section aria-labelledby="franchise-title">
          <h2 id="franchise-title" className={sectionTitle}>
            {t("franchise", { name: view.franchise.name })}
          </h2>
          <p className="text-sm text-text-secondary mb-3">
            {t("franchiseCount", { count: view.franchise.members.length })}
            {userId && missing.length < franchiseIds.length ? ` · ${t("inLibrary", { count: franchiseIds.length - missing.length })}` : ""}
          </p>
          <ul className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 mb-3">
            {view.franchise.members.map((l) => (
              <Tile key={l.mediaId} link={withPoster(l)} typeLabel={typeLabel(l)} />
            ))}
          </ul>
          {userId ? (
            missing.length > 0 ? (
              <AddFranchiseButton
                mediaIds={missing}
                labels={{
                  addAll: t("addAll", { count: missing.length }),
                  // Plantillas con {done}/{total}/{count}: las rellena el cliente.
                  adding: String(t.raw("adding")),
                  addedOne: String(t.raw("addedOne")),
                  addedOther: String(t.raw("addedOther")),
                  rateLimited: t("rateLimited"),
                  failed: t("failed"),
                }}
              />
            ) : (
              <p className="text-[13px] text-text-secondary">{t("allInLibrary")}</p>
            )
          ) : (
            <KButton asChild variant="secondary" size="sm">
              <Link href={`/login?mode=register&next=${next}`} rel="nofollow">
                {t("loginToAdd")}
              </Link>
            </KButton>
          )}
        </section>
      )}

      <p className="text-xs text-text-tertiary">
        {t("sourceLabel")}{" "}
        <a
          href={stored?.qid ? `https://www.wikidata.org/wiki/${stored.qid}` : "https://www.wikidata.org/"}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-accent-pink"
        >
          Wikidata
        </a>
      </p>
    </div>
  );
}
