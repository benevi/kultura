import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { APP_CLIENT_NAMESPACES, pickMessages } from "@/i18n/client-messages";

/**
 * REN-5: textos de los componentes cliente de la zona con sesión. Va en el
 * template (y no en `[locale]/layout.tsx`) para que las páginas públicas no
 * carguen con ellos; el servidor lo pinta cada vez que se entra en la zona,
 * también al llegar navegando desde una pública. Envuelve solo las páginas:
 * la cabecera y la barra de `(app)/layout.tsx` usan los del shell.
 * La cobertura la garantiza `tests/unit/shell/client-messages.test.ts`.
 */
export default async function AppTemplate({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={pickMessages(messages, APP_CLIENT_NAMESPACES)}>
      {children}
    </NextIntlClientProvider>
  );
}
