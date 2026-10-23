import { getLocale, getTranslations } from "next-intl/server";
import { renderDataAttribution } from "@/components/legal/DataAttribution";

const FOOTER_LINK =
  "inline-flex items-center min-h-11 px-3 rounded-[14px] hover:text-accent-pink transition-colors " +
  "focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus-ring";

/**
 * Pie de las páginas públicas (landing, rankings, perfil y lista públicos, legales).
 *
 * Enlaces `<a>` y no el `Link` de next-intl (REN-9): Next 14 junta en un mismo
 * manifiesto los componentes cliente de todos los layouts de `[locale]`, y el
 * `Link` también lo pinta la cabecera con sesión, así que cada página pública
 * que lo usa hereda el JS de esa cabecera (Supabase incluido). Un `<a>` del
 * servidor no carga nada; entre páginas públicas no hay estado que conservar.
 */
export async function Footer() {
  const [t, tNav, locale] = await Promise.all([getTranslations("legal"), getTranslations("nav"), getLocale()]);

  return (
    <footer className="border-t border-surface-border pt-6 pb-8 text-text-tertiary text-sm text-center flex flex-col items-center gap-2">
      <nav aria-label={tNav("footerNav")}>
        <ul className="flex flex-wrap items-center justify-center">
          <li>
            <a href={`/${locale}/privacy`} className={FOOTER_LINK}>
              {t("footerPrivacy")}
            </a>
          </li>
          <li>
            <a href={`/${locale}/terms`} className={FOOTER_LINK}>
              {t("footerTerms")}
            </a>
          </li>
        </ul>
      </nav>
      <span>© {new Date().getFullYear()} KULTURA</span>
      {await renderDataAttribution("max-w-xl px-4")}
    </footer>
  );
}
