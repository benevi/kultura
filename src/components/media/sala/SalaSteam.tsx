import { useTranslations } from "next-intl";
import { SteamShot } from "@/components/media/SteamShot";
import { SalaLink } from "@/components/sala/SalaLink";
import { cn } from "@/lib/utils/index";
import type { SteamInfo } from "@/lib/api/steam";
import { SalaFichaSection } from "./SalaFichaSection";

const HEADING_ID = "sala-ficha-steam";

/**
 * Steam en la ficha de juego con «Sala» (F2c): los mismos datos que
 * `SteamSection` (precio y descuento, Metacritic, idiomas, capturas y enlace a
 * la tienda) con la piel de «Sala»: datos en el panel (un paso de tono), sin
 * pastillas ni bordes redondeados.
 *
 * Cada captura es un enlace a la imagen grande, en otra pestaña, y su nombre
 * lo dice («Captura 2 de 4», y que se abre en otra pestaña): en la ficha de
 * hoy eran enlaces sin nombre. Server Component.
 */
export function SalaSteam({ steam }: { steam: SteamInfo }) {
  const t = useTranslations("media_detail");
  const tc = useTranslations("common");

  const priceLabel = steam.isFree ? t("steamFree") : (steam.price ?? t("steamNoPrice"));
  const shots = steam.screenshots ?? [];
  const languages = (steam.supportedLanguages ?? []).slice(0, 8);

  return (
    <SalaFichaSection id={HEADING_ID} heading={t("steamTitle")} data-sala-ficha-steam="">
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-x-12">
        <div className="min-w-0 self-start bg-sala-panel p-6 lg:col-span-5">
          <dl className="flex flex-wrap gap-x-10 gap-y-5">
            <div>
              <dt className="sala-type-small text-sala-ink-secondary">{t("steamPrice")}</dt>
              <dd className="sala-type-data">
                {priceLabel}
                {steam.priceOriginal && (
                  <span className="sala-type-small ml-2 text-sala-ink-secondary">
                    <span className="sr-only">{t("steamPriceBefore")} </span>
                    <s>{steam.priceOriginal}</s>
                  </span>
                )}
                {steam.discountPercent !== undefined && (
                  <span className="sala-type-small ml-2 whitespace-nowrap">
                    <span className="sr-only">{t("steamDiscount")} </span>−{steam.discountPercent}%
                  </span>
                )}
              </dd>
            </div>
            {steam.metacritic !== undefined && (
              <div>
                <dt className="sala-type-small text-sala-ink-secondary">Metacritic</dt>
                <dd className="sala-type-data">{steam.metacritic}</dd>
              </div>
            )}
            {languages.length > 0 && (
              <div className="basis-full">
                <dt className="sala-type-small text-sala-ink-secondary">{t("steamLanguages")}</dt>
                <dd className="sala-type-text [overflow-wrap:anywhere]">{languages.join(", ")}</dd>
              </div>
            )}
          </dl>
          <p className="mt-5">
            <SalaLink href={steam.storeUrl} variant="standalone">
              {t("steamViewOnStore")}
            </SalaLink>
          </p>
        </div>

        {shots.length > 0 && (
          <div className="min-w-0 lg:col-span-7">
            <h3 className="sala-type-small mb-3 text-sala-ink-secondary">{t("steamScreenshots")}</h3>
            <ul role="list" className="grid list-none grid-cols-2 gap-3">
              {shots.map((shot, i) => (
                <li key={shot.thumb} className="min-w-0">
                  <a
                    href={shot.full}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${t("steamScreenshotLink", { n: i + 1, total: shots.length })} ${tc("newTab")}`}
                    className={cn(
                      "relative block aspect-video max-w-full overflow-hidden bg-sala-panel",
                      "transition-opacity duration-sala-fast ease-sala motion-reduce:transition-none sala-hover:opacity-80",
                      "sala-focused:sala-focus"
                    )}
                  >
                    <SteamShot src={shot.thumb} sizes="(max-width: 1024px) 45vw, 28vw" className="object-cover" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </SalaFichaSection>
  );
}
