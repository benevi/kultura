import { getLocale, getTranslations } from "next-intl/server";
import { renderDataAttribution } from "@/components/legal/DataAttribution";
import { legalFooterLinks } from "@/lib/legal/footer-links";

const FOOTER_LINK =
  "inline-flex items-center min-h-11 px-3 rounded-2xl hover:text-accent-pink transition-colors " +
  "focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus-ring";

/**
 * Pie de las páginas públicas salvo la landing y las cuñas, que tienen el suyo
 * (`landing/LandingFooter`); los enlaces legales salen de la misma lista
 * (`legalFooterLinks`).
 *
 * Enlaces `<a>` y no el `Link` de next-intl (REN-9): Next 14 junta en un mismo
 * manifiesto los componentes cliente de todos los layouts de `[locale]`, y el
 * `Link` también lo pinta la cabecera con sesión, así que cada página pública
 * que lo usa hereda el JS de esa cabecera (Supabase incluido). Un `<a>` del
 * servidor no carga nada; entre páginas públicas no hay estado que conservar.
 */
export async function Footer() {
  const [t, tNav, locale] = await Promise.all([getTranslations("legal"), getTranslations("nav"), getLocale()]);
  const links = legalFooterLinks(t);

  return (
    <footer className="border-t border-surface-border pt-6 pb-8 text-text-tertiary text-sm text-center flex flex-col items-center gap-2">
      <nav aria-label={tNav("footerNav")}>
        <ul className="flex flex-wrap items-center justify-center">
          {links.map((l) => (
            <li key={l.href}>
              <a href={`/${locale}${l.href}`} className={FOOTER_LINK}>
                {l.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <span>© {new Date().getFullYear()} KULTURA</span>
      {await renderDataAttribution("max-w-xl px-4")}
    </footer>
  );
}
