import { getLocale, getTranslations } from "next-intl/server";
import { renderDataAttribution } from "@/components/legal/DataAttribution";

const FOOTER_LINK =
  "inline-flex items-center min-h-11 px-3 rounded-2xl hover:text-accent-pink transition-colors " +
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
  const [t, tNav, tBest, locale] = await Promise.all([
    getTranslations("legal"),
    getTranslations("nav"),
    getTranslations("best"),
    getLocale(),
  ]);
  // Aviso legal y accesibilidad (F-19): sus rótulos viven en `legal.nav`. Hasta
  // que esas claves estén en master se usa el respaldo de `best.footer`; cuando
  // lo estén, el respaldo sobra y se puede quitar.
  const label = (key: "notice" | "accessibility") =>
    typeof t.has === "function" && t.has(`nav.${key}`) ? t(`nav.${key}`) : tBest(`footer.${key}`);
  const links = [
    { href: "/privacy", text: t("footerPrivacy") },
    { href: "/terms", text: t("footerTerms") },
    { href: "/legal", text: label("notice") },
    { href: "/accessibility", text: label("accessibility") },
  ];

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
