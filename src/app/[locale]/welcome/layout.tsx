import { ClientMessages } from "@/i18n/ClientMessages";
import { WELCOME_CLIENT_NAMESPACES } from "@/i18n/client-messages";

/**
 * REN-5: los textos del onboarding y de las primeras recomendaciones viajan
 * solo a /welcome, no en el shell de todas las páginas públicas.
 */
export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return <ClientMessages namespaces={WELCOME_CLIENT_NAMESPACES}>{children}</ClientMessages>;
}
