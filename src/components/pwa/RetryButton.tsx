"use client";

import { useEffect } from "react";
import { KButton } from "@/components/ui/KButton";
import { retryTarget } from "./retry";

interface RetryButtonProps {
  label: string;
  /** Adónde ir si la propia URL es la página offline (recargarla no sirve). */
  homeHref: string;
}

/**
 * La página offline se sirve EN LA URL que falló (`/es/library` sin red pinta
 * `/es/offline`): reintentar es recargar esa URL. Si alguien abrió
 * `/es/offline` a mano, se va a la portada. Al volver la red, se reintenta
 * solo. El texto llega del servidor: ningún namespace de textos en el cliente.
 */
export function RetryButton({ label, homeHref }: RetryButtonProps) {
  useEffect(() => {
    const retry = () => retryNavigation(homeHref);
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [homeHref]);

  return (
    <KButton type="button" variant="primary" onClick={() => retryNavigation(homeHref)}>
      {label}
    </KButton>
  );
}

function retryNavigation(homeHref: string) {
  const target = retryTarget(window.location.pathname, homeHref);
  if (target) window.location.assign(target);
  else window.location.reload();
}
