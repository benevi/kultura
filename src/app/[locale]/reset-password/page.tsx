import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ResetPasswordForm } from "./ResetPasswordForm";
import { SobreStage } from "../login/SobreStage";
import { SobreWall } from "../login/SobreWall";

interface ResetPasswordRouteProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ResetPasswordRouteProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return {
    title: t("resetMetaTitle"),
    robots: { index: false, follow: false },
    alternates: { canonical: `/${locale}/reset-password` },
  };
}

/**
 * `/[locale]/reset-password` — elegir una contraseña nueva (R1).
 *
 * Llegan aquí el enlace de recuperación del correo (vía `/api/auth/callback`,
 * que ya deja la sesión abierta) y "Cambiar contraseña" de Ajustes. Fuera de
 * `(app)` a propósito: ese layout exige perfil y pinta la navegación, y esta
 * pantalla tiene que funcionar con cualquier sesión válida.
 */
export default async function ResetPasswordRoute({ params }: ResetPasswordRouteProps) {
  const { locale } = await params;
  return (
    <Suspense>
      <ResetPasswordForm
        locale={locale}
        wall={
          <Suspense fallback={<SobreStage covers={[]} />}>
            <SobreWall locale={locale} />
          </Suspense>
        }
      />
    </Suspense>
  );
}
