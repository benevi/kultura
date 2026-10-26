// ============================================================
// KULTURA — "También existe como…" en la ficha (F-29, PRO-11)
// Server Component async: la ficha lo pinta dentro de un <Suspense> para que
// la consulta a Wikidata (o a su caché) nunca retrase el resto de la página.
// Sin vínculos no pinta nada.
//
// Diseño (DISENO.md): fila de tarjetas compactas con portada pequeña y el
// gradiente de póster SIEMPRE detrás, chip de relación "outline" y el mismo
// título de sección que el resto de la ficha. Al final, "Añadir toda la
// franquicia" (con sesión) y la cita de la fuente (Wikidata, CC0).
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { getTranslations } from "next-intl/server";
import type { MediaItem } from "@/types/media";
import { posterGradient } from "@/lib/images/poster-gradient";
import { Link } from "@/i18n/navigation";
import { mediaPath } from "@/lib/media/seo";
import { getAdaptations } from "@/lib/adaptations/load";
import { buildAdaptationView } from "@/lib/adaptations/display";
import { SOURCE_LINK_CLASS } from "@/components/legal/DataAttribution";
import { PosterImage } from "./PosterImage";
import { AddFranchiseButton } from "./AddFranchiseButton";

const sectionTitle = "font-display text-xl font-bold text-text-primary mb-1";
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base";

interface Props {
  item: Pick<MediaItem, "id" | "type" | "externalId" | "title" | "metadata">;
  locale: string;
  /** Con sesión: para "En tu biblioteca" y "Añadir toda la franquicia". */
  userId: string | null;
  supabase: SupabaseClient | null;
}

export async function AdaptationsSection({ item, locale, userId, supabase }: Props) {
  const { links } = await getAdaptations(item);
  if (links.length === 0) return null;
  const view = await buildAdaptationView(links, { locale, userId, supabase });
  if (view.cards.length === 0) return null;

  const [t, tMedia] = await Promise.all([
    getTranslations({ locale, namespace: "adaptations" }),
    getTranslations({ locale, namespace: "media" }),
  ]);
  const selfPath = mediaPath(locale, item.type, item.externalId);

  return (
    <section aria-labelledby="adaptations-title">
      <h2 id="adaptations-title" className={sectionTitle}>
        {t("title")}
      </h2>
      <p className="text-sm text-text-secondary leading-relaxed mb-4">{t("subtitle")}</p>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {view.cards.map((card) => {
          const typeLabel = tMedia(card.type);
          return (
            <li key={card.mediaId}>
              <Link
                href={`/media/${card.type}/${encodeURIComponent(card.externalId)}`}
                className={`group flex items-center gap-3 rounded-18 bg-surface-default p-2.5 pr-4 min-h-11 hover:bg-surface-elevated transition-colors ${FOCUS}`}
              >
                <span
                  className="relative w-12 h-[72px] flex-shrink-0 rounded-card overflow-hidden"
                  style={{ background: posterGradient(card.mediaId) }}
                  aria-hidden="true"
                >
                  {card.poster && <PosterImage src={card.poster} sizes="48px" className="object-cover" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-sm text-text-primary line-clamp-2 group-hover:text-accent-pink transition-colors">
                    {card.title}
                  </span>
                  <span className="block text-xs text-text-tertiary mt-0.5">
                    {card.year ? t("meta", { type: typeLabel, year: String(card.year) }) : typeLabel}
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="rounded-full border-2 border-surface-border text-text-secondary font-bold text-[11px] px-2.5 py-0.5">
                      {t(`relation.${card.relation}`)}
                    </span>
                    {card.inLibrary && (
                      <span className="rounded-full bg-surface-elevated text-text-secondary font-bold text-[11px] px-2.5 py-0.5">
                        {t("inLibrary")}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-col gap-2">
        {userId ? (
          view.addable.length > 1 ? (
            <AddFranchiseButton items={view.addable} />
          ) : view.addable.length === 0 ? (
            <p className="text-xs text-text-tertiary">{t("add.allIn")}</p>
          ) : null
        ) : view.addable.length > 1 ? (
          <Link
            href={`/login?mode=login&next=${encodeURIComponent(selfPath)}`}
            rel="nofollow"
            className={`self-start text-sm font-bold text-text-primary underline underline-offset-2 hover:text-accent-pink rounded-[4px] min-h-11 inline-flex items-center ${FOCUS}`}
          >
            {t("loginToAdd")}
          </Link>
        ) : null}
        <p className="text-xs text-text-tertiary leading-relaxed">
          {t("sourceLabel")}{" "}
          <a
            href="https://www.wikidata.org/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("sourceLinkLabel")}
            className={SOURCE_LINK_CLASS}
          >
            Wikidata
          </a>
        </p>
      </div>
    </section>
  );
}
