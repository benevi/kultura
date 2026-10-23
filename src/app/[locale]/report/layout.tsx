import { ClientMessages } from "@/i18n/ClientMessages";
import { REPORT_CLIENT_NAMESPACES } from "@/i18n/client-messages";

/**
 * REN-5: los textos del formulario de denuncia viajan solo a esta página, no
 * en el shell de todas las públicas.
 */
export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return <ClientMessages namespaces={REPORT_CLIENT_NAMESPACES}>{children}</ClientMessages>;
}
