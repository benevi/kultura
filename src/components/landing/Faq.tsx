// ============================================================
// KULTURA — Preguntas frecuentes (CRE-10, SEO-9)
//
// `<details>`/`<summary>` nativos: se abren con teclado y lector de pantalla
// sin JavaScript, y el texto está en el HTML (lo lee Google aunque esté
// plegado). Filas planas `--surface-default` con radio 20 (DISENO.md); el
// signo + gira a × al abrir, solo con `motion-safe`.
// ============================================================

import type { FaqItem } from "@/lib/landing/faq";

export function Faq({ heading, items }: { heading: string; items: FaqItem[] }) {
  return (
    <section aria-labelledby="faq-title" className="page-grid pb-20 md:pb-28">
      <h2
        id="faq-title"
        className="font-display text-4xl md:text-6xl font-extrabold tracking-[-0.03em] text-text-primary mb-12 max-w-[14ch]"
      >
        {heading}
      </h2>
      <div className="flex max-w-3xl flex-col gap-2.5">
        {items.map((it) => (
          <details key={it.key} className="group rounded-bento bg-surface-default">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-bento px-6 py-4 font-display text-lg font-extrabold text-text-primary focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring [&::-webkit-details-marker]:hidden">
              {it.q}
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-xl leading-none motion-safe:transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="px-6 pb-5 text-base leading-relaxed text-text-secondary max-w-[62ch]">{it.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
