import { useTranslations } from "next-intl";
import { SalaLink } from "@/components/sala/SalaLink";
import { SalaWorkCard } from "@/components/sala/SalaWorkCard";
import { SalaWorkList } from "@/components/sala/SalaWorkList";
import type { AdaptationView } from "@/lib/adaptations/display";
import { AddFranchiseButton } from "../AddFranchiseButton";
import { SalaFichaSection } from "./SalaFichaSection";

const HEADING_ID = "adaptations-title";

/**
 * «También existe como…» en la ficha con «Sala» (F2c): las mismas obras que
 * `AdaptationsSection` (que es quien las busca y decide si se pinta), como
 * `SalaWorkCard` en fila dentro de una `SalaWorkList`. Debajo, «Añadir toda la
 * franquicia» (o entrar para hacerlo) y la cita de Wikidata, siempre visible.
 *
 * El formato de cada obra va en palabras (`formatLabel`), la relación y «En tu
 * biblioteca» en su línea de datos. Server Component.
 */
export function SalaAdaptations({
  view,
  userId,
  loginHref,
}: {
  view: AdaptationView;
  userId: string | null;
  /** Entrar y volver a esta ficha, para quien no tiene sesión. */
  loginHref: string;
}) {
  const t = useTranslations("adaptations");
  const tMedia = useTranslations("media");
  const tc = useTranslations("common");

  return (
    <SalaFichaSection id={HEADING_ID} heading={t("title")} data-sala-ficha-adaptations="">
      <p className="sala-type-text -mt-2 mb-6 max-w-prose text-sala-ink-secondary">{t("subtitle")}</p>
      <SalaWorkList
        aria-labelledby={HEADING_ID}
        variant="row"
        loadingLabel={tc("loading")}
        className="grid gap-6 sm:grid-cols-2"
      >
        {view.cards.map((card) => (
          <SalaWorkCard
            key={card.mediaId}
            variant="row"
            href={`/media/${card.type}/${encodeURIComponent(card.externalId)}`}
            title={card.title}
            format={card.type}
            formatLabel={tMedia(card.type)}
            year={card.year}
            poster={card.poster}
            headingLevel={3}
            detail={
              card.inLibrary ? `${t(`relation.${card.relation}`)} · ${t("inLibrary")}` : t(`relation.${card.relation}`)
            }
          />
        ))}
      </SalaWorkList>

      <div className="mt-8 flex flex-col items-start gap-3">
        {userId ? (
          view.addable.length > 1 ? (
            <AddFranchiseButton items={view.addable} skin="sala" />
          ) : view.addable.length === 0 ? (
            <p className="sala-type-small text-sala-ink-secondary">{t("add.allIn")}</p>
          ) : null
        ) : view.addable.length > 1 ? (
          <SalaLink href={loginHref} variant="standalone" rel="nofollow">
            {t("loginToAdd")}
          </SalaLink>
        ) : null}
        <p className="flex flex-wrap items-center gap-x-2 sala-type-small text-sala-ink-secondary">
          <span>{t("sourceLabel")}</span>
          <SalaLink href="https://www.wikidata.org/" variant="standalone">
            Wikidata
          </SalaLink>
        </p>
      </div>
    </SalaFichaSection>
  );
}
