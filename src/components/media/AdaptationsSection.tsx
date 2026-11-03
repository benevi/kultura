// ============================================================
// KULTURA — "También existe como…" en la ficha (F-29, PRO-11)
// Server Component async: la ficha lo pinta dentro de un <Suspense> para que
// la consulta a Wikidata (o a su caché) nunca retrase el resto de la página.
// Sin vínculos no pinta nada.
//
// Diseño (DISENO.md): los otros formatos como cromos (el respaldo de color
// SIEMPRE detrás de la portada), con el título, el formato (punto + nombre),
// el año y la relación debajo, y el mismo título de sección que el resto de
// la ficha. Al final, "Añadir toda la franquicia" (con la cuenta abierta) y la cita de
// la fuente (Wikidata, CC0).
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { getTranslations } from "next-intl/server";
import type { MediaItem } from "@/types/media";
import { Link } from "@/i18n/navigation";
import { Cromo } from "@/components/album/Cromo";
import { FormatTag } from "@/components/album/FormatTag";
import { mediaPath } from "@/lib/media/seo";
import { getAdaptations } from "@/lib/adaptations/load";
import { buildAdaptationView } from "@/lib/adaptations/display";
import { SOURCE_LINK_CLASS } from "@/components/legal/DataAttribution";
import { AddFranchiseButton } from "./AddFranchiseButton";

const sectionTitle = "mb-3 font-display text-2xl text-text-primary";
const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

interface Props {
  item: Pick<MediaItem, "id" | "type" | "externalId" | "title" | "metadata">;
  locale: string;
  /** Con sesión: para "En tu biblioteca" y "Añadir toda la franquicia". */
  userId: string | null;
  supabase: SupabaseClient | null;
}

/**
 * Tope de la sección: la respuesta en streaming no se cierra hasta que llega,
 * y una ficha no puede quedarse abierta lo que tarde Wikidata en un mal día.
 * Pasado el tope sale sin la sección (la consulta sigue y, si acaba, la
 * siguiente visita ya la encuentra en la tabla).
 */
export const ADAPTATIONS_SECTION_BUDGET_MS = 7000;

function withinBudget<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ADAPTATIONS_SECTION_BUDGET_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}

export async function AdaptationsSection({ item, locale, userId, supabase }: Props) {
  const { links } = await withinBudget(getAdaptations(item), { links: [], source: "none" as const });
  if (links.length === 0) return null;
  const view = await buildAdaptationView(links, { locale, userId, supabase });
  if (view.cards.length === 0) return null;

  const [t, tAlbum] = await Promise.all([
    getTranslations({ locale, namespace: "adaptations" }),
    getTranslations({ locale, namespace: "album" }),
  ]);
  const selfPath = mediaPath(locale, item.type, item.externalId);

  return (
    <section aria-labelledby="adaptations-title">
      <h2 id="adaptations-title" className={sectionTitle}>
        {t("title")}
      </h2>

      {/* Cromos de los otros formatos: el título y su relación debajo. */}
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {view.cards.map((card) => (
          <li key={card.mediaId} className="min-w-0">
            <Link
              href={`/media/${card.type}/${encodeURIComponent(card.externalId)}`}
              className={`group block rounded-cromo ${FOCUS}`}
            >
              <Cromo
                title={card.title}
                seed={card.mediaId}
                poster={card.poster}
                sizes="(max-width: 640px) 30vw, 140px"
              />
              <span className="mt-2 line-clamp-2 break-words text-sm font-semibold leading-tight text-text-primary">
                {card.title}
              </span>
              <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-tertiary">
                <FormatTag format={card.type} label={tAlbum(`format.${card.type}`)} />
                {card.year ? <span className="tabular-nums">{card.year}</span> : null}
              </span>
              <span className="mt-1 block text-xs font-semibold text-text-secondary">
                {t(`relation.${card.relation}`)}
                {card.inLibrary ? <span className="font-normal text-text-tertiary"> · {t("inLibrary")}</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-col gap-2">
        {userId ? (
          view.addable.length > 1 ? (
            <AddFranchiseButton items={view.addable} userId={userId} />
          ) : view.addable.length === 0 ? (
            <p className="text-xs text-text-tertiary">{t("add.allIn")}</p>
          ) : null
        ) : view.addable.length > 1 ? (
          <Link
            href={`/login?mode=login&next=${encodeURIComponent(selfPath)}`}
            rel="nofollow"
            className={`self-start text-sm font-bold text-text-primary underline underline-offset-2 rounded-lg min-h-11 inline-flex items-center ${FOCUS}`}
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
