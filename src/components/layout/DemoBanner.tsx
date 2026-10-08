"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { KButton } from "@/components/ui/KButton";
import { useToastContext } from "@/components/ui/ToastProvider";

const WRITE = /^(POST|PUT|PATCH|DELETE)$/i;

/**
 * ¿Es esta respuesta una escritura rechazada por ser la demo? Dos orígenes:
 * el middleware (`/api/*`, 403 con `demo_read_only`) y la base (escrituras
 * directas del cliente de Supabase, que la política RLS rechaza con 403).
 */
export function isDemoRejection(method: string, url: string, status: number): boolean {
  if (status !== 403 || !WRITE.test(method)) return false;
  return url.includes("/api/") || url.includes("/rest/v1/");
}

/**
 * Aviso fijo de la cuenta demo (E-DEMO) + el toast de "no se guarda".
 *
 * La demo es de solo lectura y las escrituras se rechazan en el servidor;
 * sin esto, cada botón fallaría con su error genérico y parecería que la app
 * está rota. En vez de tocar cada componente que escribe, se observa `fetch`
 * (por ahí van tanto las rutas de la API como el cliente de Supabase) y se
 * avisa una sola vez por rechazo. Solo se monta para la cuenta demo.
 */
export function DemoBanner() {
  const t = useTranslations("demo");
  const locale = useLocale();
  const { show } = useToastContext();
  const message = t("readOnly");

  React.useEffect(() => {
    const original = window.fetch;
    const wrapped: typeof window.fetch = async (input, init) => {
      const res = await original(input, init);
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (isDemoRejection(method, url, res.status)) show({ message, type: "info" });
      return res;
    };
    window.fetch = wrapped;
    return () => {
      if (window.fetch === wrapped) window.fetch = original;
    };
  }, [show, message]);

  return (
    <div className="border-b border-surface-border bg-surface-elevated">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 md:px-8">
        <p className="text-sm text-text-secondary">
          <span className="font-bold text-text-primary">{t("title")}</span> {t("body")}
        </p>
        <form action="/api/auth/demo/exit" method="post">
          <input type="hidden" name="locale" value={locale} />
          <KButton type="submit" variant="primary" size="sm">
            {t("cta")}
          </KButton>
        </form>
      </div>
    </div>
  );
}
