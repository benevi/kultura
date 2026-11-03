// ============================================================
// KULTURA — «Lo que hay detrás» (campo amarillo)
//
// Credibilidad sin inventar nada (no hay usuarios que contar ni
// testimonios): el modelo de negocio dicho tal cual («gratis, sin anuncios,
// sin plan de pago»), el criterio publicado de los rankings, de dónde salen
// los datos (proveedores con su nombre) y quién la hace, con nombre. Cuatro
// dorsos de cromo: papel blanco, raya de tinta, texto impreso.
// ============================================================

import { AlbumPage } from "@/components/album/AlbumPage";

export const TRUST_KEYS = ["free", "rankings", "data", "maker"] as const;
export type TrustKey = (typeof TRUST_KEYS)[number];

export interface TrustProps {
  heading: string;
  blocks: Record<TrustKey, { title: string; body: string }>;
  /** Enlace al índice de rankings desde el bloque del criterio. */
  rankingsHref: string;
  rankingsLabel: string;
}

export function Trust({ heading, blocks, rankingsHref, rankingsLabel }: TrustProps) {
  return (
    <AlbumPage tone="yellow" aria-labelledby="trust-title" className="py-16 md:py-24">
      <h2 id="trust-title" className="mb-8 text-balance font-display text-3xl text-text-primary md:mb-12 md:text-4xl">
        {heading}
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        {TRUST_KEYS.map((key) => (
          <article
            key={key}
            className="theme-paper flex flex-col gap-3 rounded-2xl border-2 border-album-navy p-5 md:p-7 first:md:col-span-2"
          >
            <h3 className="text-balance font-display text-2xl text-text-primary">{blocks[key].title}</h3>
            <p className="max-w-[62ch] text-base text-text-secondary">{blocks[key].body}</p>
            {key === "rankings" ? (
              <a
                href={rankingsHref}
                className="mt-auto inline-flex min-h-11 w-fit items-center rounded-lg text-sm font-semibold text-text-primary underline underline-offset-4 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                {rankingsLabel}
              </a>
            ) : null}
          </article>
        ))}
      </div>
    </AlbumPage>
  );
}
