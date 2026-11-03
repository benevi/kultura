// ============================================================
// KULTURA — Preguntas frecuentes (CRE-10, SEO-9)
//
// `<details>`/`<summary>` nativos: se abren con teclado y lector de pantalla
// sin JavaScript, y el texto está en el HTML (lo lee Google aunque esté
// plegado). Página blanca del álbum con rayas de tinta de 2 px entre
// preguntas; el signo + (dibujado, no un carácter) gira a × al abrir, solo
// con `motion-safe`.
// ============================================================

import { AlbumPage } from "@/components/album/AlbumPage";
import type { FaqItem } from "@/lib/landing/faq";

export function Faq({ heading, items }: { heading: string; items: FaqItem[] }) {
  return (
    <AlbumPage aria-labelledby="faq-title" className="py-16 md:py-24">
      <h2 id="faq-title" className="mb-8 font-display text-3xl text-text-primary md:mb-12 md:text-4xl">
        {heading}
      </h2>
      <div className="max-w-3xl border-b-2 border-surface-border">
        {items.map((it) => (
          <details key={it.key} className="group border-t-2 border-surface-border">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-lg py-4 text-lg font-semibold text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring [&::-webkit-details-marker]:hidden">
              {it.q}
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="h-6 w-6 shrink-0 motion-safe:transition-transform motion-safe:duration-fast group-open:rotate-45"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </summary>
            <p className="max-w-[62ch] pb-5 text-base text-text-secondary">{it.a}</p>
          </details>
        ))}
      </div>
    </AlbumPage>
  );
}
