import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function Footer() {
  const t = await getTranslations("legal");

  return (
    <footer className="border-t border-border py-8 text-muted text-sm text-center flex flex-col items-center gap-2">
      <div className="flex items-center gap-4">
        <Link href="/privacy" className="hover:text-accent-positive transition-colors">
          {t("footerPrivacy")}
        </Link>
        <Link href="/terms" className="hover:text-accent-positive transition-colors">
          {t("footerTerms")}
        </Link>
      </div>
      <span>© {new Date().getFullYear()} KULTURA</span>
    </footer>
  );
}
