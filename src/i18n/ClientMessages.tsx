import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { pickMessages } from "./client-messages";

/**
 * Proveedor de textos para los componentes cliente de una zona (REN-5). Un
 * proveedor anidado SUSTITUYE los mensajes del de fuera: `namespaces` tiene
 * que llevar todo lo que usen los componentes cliente que envuelve. Lo
 * comprueba `tests/unit/shell/client-messages.test.ts`.
 */
export async function ClientMessages({
  namespaces,
  children,
}: {
  namespaces: readonly string[];
  children: React.ReactNode;
}) {
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={pickMessages(messages, namespaces)}>{children}</NextIntlClientProvider>
  );
}
