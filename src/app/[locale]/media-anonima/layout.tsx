import { setRequestLocale } from "next-intl/server";
import { ClientMessages } from "@/i18n/ClientMessages";
import { MEDIA_CLIENT_NAMESPACES } from "@/i18n/client-messages";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ToastProvider } from "@/components/ui/ToastProvider";

/**
 * Ficha cacheable para visitantes sin sesión (bandera `FICHA_ISR`). La misma
 * cabecera y pie públicos que `media/layout.tsx` sin sesión, pero sin leer la
 * sesión: aquí solo llega quien no trae cookie de Supabase (lo decide el
 * middleware) y nada de lo que se pinta puede depender de cookies o cabeceras,
 * o la página dejaría de poder guardarse en la caché ISR.
 */
export default async function FichaAnonimaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <ToastProvider>
      <div className="min-h-dvh flex flex-col">
        <Header locale={locale} />
        <div className="flex-1">
          <ClientMessages namespaces={MEDIA_CLIENT_NAMESPACES}>{children}</ClientMessages>
        </div>
        <Footer />
      </div>
    </ToastProvider>
  );
}
