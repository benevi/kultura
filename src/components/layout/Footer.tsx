import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BEST_FORMATS } from "@/lib/best/best-of";
import { renderDataAttribution } from "@/components/legal/DataAttribution";

export async function Footer() {
  const t = await getTranslations("legal");
  const tb = await getTranslations("best");
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border py-8 text-muted text-sm text-center flex flex-col items-center gap-2">
      <nav aria-label={tb("otherLabel")} className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4">
        {BEST_FORMATS.map((f) => (
          <Link key={f} href={`/best/${f}/${year}`} className="hover:text-accent-positive transition-colors">
            {tb(`title.${f}`, { year })}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-4">
        <Link href="/privacy" className="hover:text-accent-positive transition-colors">
          {t("footerPrivacy")}
        </Link>
        <Link href="/terms" className="hover:text-accent-positive transition-colors">
          {t("footerTerms")}
        </Link>
      </div>
      <span>© {new Date().getFullYear()} KULTURA</span>
      {await renderDataAttribution("max-w-xl px-4")}
    </footer>
  );
}
