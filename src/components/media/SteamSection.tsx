// ============================================================
// KULTURA — SteamSection (E-GAMES-STEAM)
// Bloque de la ficha de juego con los datos que aporta Steam: precio (con
// descuento si lo hay), idiomas soportados, capturas y enlace a la tienda.
//
// Solo se renderiza si `getSteamInfoForGame` resolvió el juego con confianza;
// la ficha funciona igual sin este bloque (degradación silenciosa).
// Server Component (usa getTranslations), mobile-first.
// ============================================================

import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import type { SteamInfo } from "@/lib/api/steam";

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";
const DATUM = "inline-flex items-baseline gap-2 rounded-lg border-2 border-surface-border px-3 py-1.5";
const LABEL = "mb-1.5 text-meta font-semibold text-text-secondary";

export async function SteamSection({ steam }: { steam: SteamInfo }) {
  const t = await getTranslations("media_detail");
  const locale = await getLocale();

  const priceLabel = steam.isFree ? t("steamFree") : (steam.price ?? t("steamNoPrice"));
  // «−50 %» con el formato del idioma (espacio duro ante el % en español).
  const discount =
    steam.discountPercent !== undefined
      ? new Intl.NumberFormat(locale, { style: "percent", signDisplay: "always" }).format(-steam.discountPercent / 100)
      : null;

  return (
    <section aria-labelledby="steam-heading">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <h2 id="steam-heading" className="font-display text-2xl text-text-primary">
          {t("steamTitle")}
        </h2>
        <a
          href={steam.storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-text-primary underline underline-offset-2 ${FOCUS}`}
        >
          {t("steamViewOnStore")}
        </a>
      </div>

      {/* Precio + Metacritic: fila de datos compacta, envuelve en móvil. */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className={DATUM}>
          <span className="text-sm font-semibold text-text-primary">{priceLabel}</span>
          {steam.priceOriginal ? (
            <span className="text-xs text-text-tertiary line-through">{steam.priceOriginal}</span>
          ) : null}
          {discount !== null ? <span className="text-xs font-bold tabular-nums text-accent-positive">{discount}</span> : null}
        </span>

        {steam.metacritic !== undefined ? (
          <span className={DATUM}>
            <span className="text-xs text-text-tertiary">Metacritic</span>
            <span className="text-sm font-semibold tabular-nums text-text-primary">{steam.metacritic}</span>
          </span>
        ) : null}
      </div>

      {steam.supportedLanguages && steam.supportedLanguages.length > 0 ? (
        <div className="mb-4">
          <p className={LABEL}>{t("steamLanguages")}</p>
          <ul className="flex flex-wrap gap-1.5">
            {steam.supportedLanguages.slice(0, 8).map((lang) => (
              <li
                key={lang}
                className="rounded-full border-2 border-surface-border px-2.5 py-0.5 text-xs font-semibold text-text-secondary"
              >
                {lang}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {steam.screenshots && steam.screenshots.length > 0 ? (
        <div>
          <p className={LABEL}>{t("steamScreenshots")}</p>
          <ul className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {steam.screenshots.map((shot, i) => (
              <li key={shot.thumb}>
                <a
                  href={shot.full}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("steamScreenshotLabel", { number: i + 1 })}
                  className={`relative block aspect-video max-w-full overflow-hidden rounded-cromo border-2 border-surface-border transition-colors hover:border-text-tertiary ${FOCUS}`}
                >
                  <Image src={shot.thumb} alt="" fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
