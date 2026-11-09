import { ClientMessages } from "@/i18n/ClientMessages";
import { PUBLIC_PROFILE_CLIENT_NAMESPACES } from "@/i18n/client-messages";
import { V2Scope } from "@/v2/V2Scope";

/**
 * REN-5: los textos de "Invitar amigos" y de la denuncia con sesión viajan
 * solo a los perfiles y listas públicas, no en el shell de todas las públicas.
 */
export default function PublicProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClientMessages namespaces={PUBLIC_PROFILE_CLIENT_NAMESPACES}>
      <V2Scope>{children}</V2Scope>
    </ClientMessages>
  );
}
