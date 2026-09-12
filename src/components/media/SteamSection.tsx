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
import { getTranslations } from "next-intl/server";
import type { SteamInfo } from "@/lib/api/steam";

export async function SteamSection({ steam }: { steam: SteamInfo }) {
  const t = await getTranslations("media_detail");

  const priceLabel = steam.isFree
    ? t("steamFree")
    : (steam.price ?? t("steamNoPrice"));

  return (
    <section aria-labelledby="steam-heading">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3">
        <h2
          id="steam-heading"
          className="font-display text-xl text-text"
        >
          {t("steamTitle")}
        </h2>
        <a
          href={steam.storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-accent-info hover:text-accent-info/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-positive rounded"
        >
          {t("steamViewOnStore")}
        </a>
      </div>

      {/* Precio + Metacritic: fila de datos compacta, envuelve en móvil. */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className="inline-flex items-baseline gap-2 rounded-button bg-surface-elevated border border-surface-border px-3 py-1.5">
          <span className="text-sm font-medium text-text">{priceLabel}</span>
          {steam.priceOriginal && (
            <span className="text-xs text-muted line-through">
              {steam.priceOriginal}
            </span>
          )}
          {steam.discountPercent !== undefined && (
            <span className="text-xs font-bold text-accent-positive">
              −{steam.discountPercent}%
            </span>
          )}
        </span>

        {steam.metacritic !== undefined && (
          <span className="inline-flex items-baseline gap-1.5 rounded-button bg-surface-elevated border border-surface-border px-3 py-1.5">
            <span className="text-xs text-muted uppercase tracking-wide">
              Metacritic
            </span>
            <span className="text-sm font-medium text-text">
              {steam.metacritic}
            </span>
          </span>
        )}
      </div>

      {steam.supportedLanguages && steam.supportedLanguages.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-muted uppercase tracking-wide mb-1.5">
            {t("steamLanguages")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {steam.supportedLanguages.slice(0, 8).map((lang) => (
              <span
                key={lang}
                className="text-xs bg-surface-elevated border border-surface-border px-2 py-0.5 rounded-full text-text-secondary"
              >
                {lang}
              </span>
            ))}
          </div>
        </div>
      )}

      {steam.screenshots && steam.screenshots.length > 0 && (
        <div>
          <p className="text-xs text-muted uppercase tracking-wide mb-1.5">
            {t("steamScreenshots")}
          </p>
          <ul className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {steam.screenshots.map((shot) => (
              <li key={shot.thumb}>
                <a
                  href={shot.full}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block relative aspect-video max-w-full overflow-hidden rounded-card border border-surface-border hover:border-text-tertiary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-positive"
                >
                  <Image
                    src={shot.thumb}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover"
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
