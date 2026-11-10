"use client";

// ============================================================
// KULTURA — CTA de las mini-landings de F1 (prueba de humo, D2)
//
// La página sale del CDN y no puede leer la URL en el servidor, así que el
// `href` del servidor solo lleva la cuña (`wedge`). Al montar, esta isla le
// añade los `utm_*` con los que llegó la visita, para que el alta quede
// atribuida a la comunidad. Sin cookies ni almacenamiento. Sin JS, el enlace
// funciona igual y conserva la cuña.
//
// El clic se manda como evento personalizado de Vercel Web Analytics. En el
// plan Hobby puede que no se registre (no verificado).
// ============================================================

import { useEffect, useRef } from "react";
import { track } from "@vercel/analytics";
import { UTM_KEYS, type Wedge } from "@/lib/analytics/attribution";

export function WedgeCta({ href, wedge, children }: { href: string; wedge: Wedge; children: string }) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const link = ref.current;
    if (!link) return;
    const from = new URLSearchParams(window.location.search);
    const url = new URL(link.href);
    for (const key of UTM_KEYS) {
      const value = from.get(key);
      if (value) url.searchParams.set(key, value.slice(0, 100));
    }
    link.href = url.toString();
  }, []);

  return (
    <a ref={ref} className="kl-btn is-scene" href={href} onClick={() => track("cta_click", { wedge })}>
      {children}
    </a>
  );
}
