import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { KButton } from "@/components/ui/KButton";
import { Logo } from "@/components/layout/Logo";

/**
 * Cabecera pública (landing, rankings, perfil y legales).
 *
 * - Opaca y de 56 px, el mismo patrón que `AuthHeader`. Antes era
 *   `bg-surface/80`, una clase que Tailwind no generaba (DIS-1): el contenido
 *   pasaba por detrás desenfocado.
 * - Cabe en 320 px (WCAG 1.4.10, ACC-5/MOV-12): logotipo de 24 px y botones
 *   compactos por debajo de `sm`; por debajo de 360 px "Iniciar sesión" se
 *   acorta a "Entra" para no perder el acceso de quien ya tiene cuenta. El
 *   wordmark no se parte (`Logo` lleva `whitespace-nowrap`).
 */
export async function Header() {
  const t = await getTranslations("auth");
  const compact = "h-9 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm";

  return (
    <header className="sticky top-0 z-50 bg-surface-default border-b border-surface-border">
      <div className="flex h-14 justify-between items-center gap-2 max-w-6xl mx-auto px-4 md:px-8">
        <Link href="/" className="shrink-0">
          <Logo size={24} />
        </Link>
        <nav className="flex items-center gap-1.5 sm:gap-2">
          <KButton variant="secondary" size="md" className={compact} asChild>
            <Link href="/login?mode=login">
              <span className="min-[360px]:hidden">{t("signInAction")}</span>
              <span className="max-[359px]:hidden">{t("signIn")}</span>
            </Link>
          </KButton>
          <KButton variant="primary" size="md" className={compact} asChild>
            <Link href="/login?mode=register">{t("signUp")}</Link>
          </KButton>
        </nav>
      </div>
    </header>
  );
}
