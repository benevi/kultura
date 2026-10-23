import { ClientMessages } from "@/i18n/ClientMessages";
import { APP_CLIENT_NAMESPACES } from "@/i18n/client-messages";

/**
 * REN-5: textos de los componentes cliente de la zona con sesión. Va en el
 * template (y no en `[locale]/layout.tsx`) para que las páginas públicas no
 * carguen con ellos; el servidor lo pinta cada vez que se entra en la zona,
 * también al llegar navegando desde una pública. Envuelve solo las páginas:
 * la cabecera y la barra de `(app)/layout.tsx` usan los del shell.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <ClientMessages namespaces={APP_CLIENT_NAMESPACES}>{children}</ClientMessages>;
}
