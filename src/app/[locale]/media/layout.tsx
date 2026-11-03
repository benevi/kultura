import { ClientMessages } from "@/i18n/ClientMessages";
import { MEDIA_CLIENT_NAMESPACES } from "@/i18n/client-messages";
import { AppChrome, getChromeSession } from "@/components/layout/AppChrome";
import { getUnreadCount } from "@/lib/social/notifications";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { AlbumPage } from "@/components/album/AlbumPage";

/**
 * Ficha pública (D-01). Con sesión se ve dentro de la app (cabecera, avisos,
 * pie y barra inferior de `AppChrome`, como en `(app)`); sin sesión, con la
 * cabecera y el pie públicos de rankings y perfiles. A diferencia de `(app)`,
 * aquí NO se redirige a login.
 *
 * REN-5: los textos de los componentes cliente de la ficha viajan solo aquí
 * (`MEDIA_CLIENT_NAMESPACES`). El proveedor envuelve solo la página: la
 * cabecera y la barra quedan fuera y usan los del shell, como en `(app)`.
 */
export default async function MediaLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getChromeSession();
  const page = <ClientMessages namespaces={MEDIA_CLIENT_NAMESPACES}>{children}</ClientMessages>;

  if (user && profile) {
    const unreadCount = await getUnreadCount(user.id);
    return (
      <AppChrome user={user} profile={profile} unreadCount={unreadCount}>
        {page}
      </AppChrome>
    );
  }

  // Sin perfil pero con sesión (alta a medias) la ficha ya ofrece biblioteca y
  // listas, que avisan con toasts: el proveedor va también aquí.
  // Sin la cuenta abierta es una página impresa del álbum (`AlbumPage`, papel blanco):
  // la cabecera, los botones y los campos se re-visten solos.
  return (
    <ToastProvider>
      <AlbumPage as="div" contained={false} className="flex min-h-dvh flex-col">
        <Header />
        <div className="flex-1">{page}</div>
        <Footer />
      </AlbumPage>
    </ToastProvider>
  );
}
