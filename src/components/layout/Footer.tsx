import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { renderDataAttribution } from "@/components/legal/DataAttribution";

const FOOTER_LINK =
  "inline-flex items-center min-h-11 px-3 rounded-[14px] hover:text-accent-pink transition-colors " +
  "focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus-ring";

/** Pie de las páginas públicas (landing, rankings, perfil y lista públicos, legales). */
export async function Footer() {
  const t = await getTranslations("legal");
  const tNav = await getTranslations("nav");

  return (
    <footer className="border-t border-surface-border pt-6 pb-8 text-text-tertiary text-sm text-center flex flex-col items-center gap-2">
      <nav aria-label={tNav("footerNav")}>
        <ul className="flex flex-wrap items-center justify-center">
          <li>
            <Link href="/privacy" className={FOOTER_LINK}>
              {t("footerPrivacy")}
            </Link>
          </li>
          <li>
            <Link href="/terms" className={FOOTER_LINK}>
              {t("footerTerms")}
            </Link>
          </li>
        </ul>
      </nav>
      <span>© {new Date().getFullYear()} KULTURA</span>
      {await renderDataAttribution("max-w-xl px-4")}
    </footer>
  );
}
