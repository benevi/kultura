import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { KButton } from "@/components/ui/KButton";

export async function Header() {
  const t = await getTranslations("auth");

  return (
    <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-sm border-b border-border">
      <div className="flex justify-between items-center max-w-6xl mx-auto px-4 md:px-8 py-4">
        <Link href="/">
          <span className="font-display text-2xl tracking-widest text-accent-positive">
            KULTURA
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <KButton variant="secondary" size="md" asChild>
            <Link href="/login?mode=login">{t("signIn")}</Link>
          </KButton>
          <KButton variant="primary" size="md" asChild>
            <Link href="/login?mode=register">{t("signUp")}</Link>
          </KButton>
        </nav>
      </div>
    </header>
  );
}
