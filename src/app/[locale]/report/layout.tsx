import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { REPORT_CLIENT_NAMESPACES, pickMessages } from "@/i18n/client-messages";

/**
 * REN-5: los textos del formulario de denuncia viajan solo a esta página, no
 * en el shell de todas las públicas. El proveedor anidado sustituye al del
 * layout del idioma; la cobertura la comprueba
 * `tests/unit/shell/client-messages.test.ts`.
 */
export default async function ReportLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={pickMessages(messages, REPORT_CLIENT_NAMESPACES)}>
      {children}
    </NextIntlClientProvider>
  );
}
