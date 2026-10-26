"use client";

// ============================================================
// KULTURA — Aviso "Instala KULTURA" (MOV-3)
//
// Tarjeta fija abajo (encima de la BottomNav en móvil, abajo a la izquierda
// en escritorio, para no chocar con los toasts de la derecha). No es un
// diálogo: no roba el foco ni bloquea la página. Escape la cierra ("Ahora
// no") y el foco vuelve adonde estaba antes de entrar en ella. Cuándo sale
// lo decide `install-policy.ts`; en iOS enseña los dos pasos de "Añadir a
// pantalla de inicio" en lugar del botón.
//
// `appinstalled` se registra en `analytics_events` vía `/api/pwa/installed`
// (`track()`, D-12, solo usuarios registrados). Va con `sendBeacon`, que no
// pasa por `window.fetch`: así el aviso de la demo ("esto no se guarda") no
// salta por un evento que el usuario no ha pedido.
// ============================================================

import { useCallback, useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { usePathname } from "next/navigation";
import { KButton } from "@/components/ui/KButton";
import { Logo } from "@/components/layout/Logo";
import {
  detectPlatform,
  dismiss,
  markInstalled,
  readInstallState,
  registerVisit,
  shouldOfferInstall,
  writeInstallState,
  type InstallPlatform,
} from "./install-policy";
import { getDeferredPrompt, subscribeInstallPrompt, takeDeferredPrompt } from "./install-events";

export const INSTALLED_ENDPOINT = "/api/pwa/installed";

export interface InstallLabels {
  title: string;
  body: string;
  action: string;
  later: string;
  iosTitle: string;
  iosStepShare: string;
  iosStepAdd: string;
  iosDone: string;
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isStandalone(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches === true;
}

/** Registro best-effort de la instalación (sin esperar respuesta). */
export function reportInstalled(platform: InstallPlatform, source: "banner" | "browser") {
  try {
    const body = new Blob([JSON.stringify({ platform, source })], { type: "application/json" });
    navigator.sendBeacon?.(INSTALLED_ENDPOINT, body);
  } catch {
    // Sin beacon no se cuenta; la instalación ya está hecha.
  }
}

export function InstallPrompt({ labels }: { labels: InstallLabels }) {
  const pathname = usePathname();
  const titleId = useId();
  const [platform, setPlatform] = useState<InstallPlatform>("desktop");
  const [open, setOpen] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  /** Dónde estaba el foco antes de entrar en la tarjeta (para devolverlo). */
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const evaluate = useCallback(() => {
    const now = Date.now();
    const state = registerVisit(readInstallState(storage()), now);
    writeInstallState(storage(), state);
    const current = detectPlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0);
    setPlatform(current);
    setOpen(
      shouldOfferInstall({
        state,
        now,
        pathname,
        standalone: isStandalone(),
        canPrompt: getDeferredPrompt() !== null,
        platform: current,
      }),
    );
  }, [pathname]);

  useEffect(() => {
    evaluate();
    return subscribeInstallPrompt(evaluate);
  }, [evaluate]);

  useEffect(() => {
    let fromBanner = false;
    const onInstalled = () => {
      writeInstallState(storage(), markInstalled(readInstallState(storage())));
      setOpen(false);
      reportInstalled(detectPlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0), fromBanner ? "banner" : "browser");
    };
    const onBanner = () => (fromBanner = true);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("kultura:install-accepted", onBanner);
    return () => {
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("kultura:install-accepted", onBanner);
    };
  }, []);

  /**
   * Al cerrarse con el foco dentro, el foco vuelve adonde estaba antes de
   * entrar (o al contenido principal): no se queda en un nodo que desaparece.
   */
  const restoreFocus = () => {
    const card = cardRef.current;
    if (!card || !card.contains(document.activeElement)) return;
    const back = returnFocusRef.current;
    const target = back && back.isConnected ? back : document.getElementById("main");
    target?.focus({ preventScroll: true });
  };

  const later = () => {
    writeInstallState(storage(), dismiss(readInstallState(storage()), Date.now()));
    restoreFocus();
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    later();
  };

  const onFocus = (e: FocusEvent<HTMLElement>) => {
    const from = e.relatedTarget;
    if (from instanceof HTMLElement && !e.currentTarget.contains(from)) returnFocusRef.current = from;
  };

  const install = async () => {
    const event = takeDeferredPrompt();
    restoreFocus();
    setOpen(false);
    if (!event) return;
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === "accepted") {
        window.dispatchEvent(new Event("kultura:install-accepted"));
        writeInstallState(storage(), markInstalled(readInstallState(storage())));
      } else {
        writeInstallState(storage(), dismiss(readInstallState(storage()), Date.now()));
      }
    } catch {
      // El navegador no dejó abrir el diálogo: se intentará otro día.
    }
  };

  if (!open) return null;
  const ios = platform === "ios";

  return (
    <aside
      ref={cardRef}
      aria-labelledby={titleId}
      data-testid="install-prompt"
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      className="fixed z-40 inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:inset-x-auto md:left-4 md:bottom-4 md:w-96 rounded-18 border border-surface-border bg-surface-elevated p-4 text-text-primary shadow-[0_2px_8px_rgba(0,0,0,0.15)] motion-safe:animate-toast-in"
    >
      <div className="flex items-start gap-3">
        <Logo variant="mark" size={40} />
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="font-display text-base font-bold leading-snug">
            {ios ? labels.iosTitle : labels.title}
          </h2>
          {ios ? (
            <ol className="mt-2 space-y-1.5 text-sm text-text-secondary">
              <li className="flex items-center gap-2">
                <span aria-hidden="true" className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-surface-default text-text-primary">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
                  </svg>
                </span>
                {labels.iosStepShare}
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden="true" className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-surface-default text-text-primary">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="4" width="16" height="16" rx="4" />
                    <path d="M12 8v8M8 12h8" />
                  </svg>
                </span>
                {labels.iosStepAdd}
              </li>
            </ol>
          ) : (
            <p className="mt-1 text-sm text-text-secondary">{labels.body}</p>
          )}
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        {ios ? (
          <KButton type="button" variant="primary" size="sm" onClick={later}>
            {labels.iosDone}
          </KButton>
        ) : (
          <>
            <KButton type="button" variant="secondary" size="sm" onClick={later}>
              {labels.later}
            </KButton>
            <KButton type="button" variant="primary" size="sm" onClick={install}>
              {labels.action}
            </KButton>
          </>
        )}
      </div>
    </aside>
  );
}
