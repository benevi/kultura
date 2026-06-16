"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/index";

export interface PaginationProps {
  currentPage: number;
  // E79 slice 1: gate de "next" basado en la FUENTE cruda (hasMore), NO en
  // totalPages (que sigue inflado por los post-filtros). Se mantiene en slice 1b.
  hasMore: boolean;
  // E79 slice 1b: total de páginas mostradas (= totalPages del proveedor). Pinta
  // la ventana numerada. El gate de "siguiente" sigue usando hasMore, no esto.
  totalPages: number;
  onPageChange: (page: number) => void;
}

// Sentinel de elipsis dentro de la lista de páginas a renderizar.
const ELLIPSIS = "ellipsis" as const;
type PageEntry = number | typeof ELLIPSIS;

/**
 * Ventana de paginación: SIEMPRE primera (1) y última (total); alrededor de la
 * actual current-1..current+1. Elipsis donde haya salto > 1. Mobile-first: la
 * ventana es estrecha (1 vecino a cada lado) → como mucho 7 entradas, no
 * desborda en viewport angosto.
 */
function buildPageWindow(current: number, total: number): PageEntry[] {
  if (total <= 1) return [1];

  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  const sorted = Array.from(pages)
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);

  const out: PageEntry[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push(ELLIPSIS);
    out.push(p);
    prev = p;
  }
  return out;
}

export function Pagination({
  currentPage,
  hasMore,
  totalPages,
  onPageChange,
}: PaginationProps) {
  const t = useTranslations("discover");
  const entries = buildPageWindow(currentPage, totalPages);

  // Botón cuadrado: tap target ≥40px (mobile-first), rounded-md, foco/hover DS.
  const baseBtn =
    "inline-flex items-center justify-center min-w-10 h-10 px-3 rounded-md " +
    "text-sm font-medium transition-colors cursor-pointer " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent " +
    "focus-visible:ring-offset-2 focus-visible:ring-offset-bg " +
    "disabled:pointer-events-none disabled:opacity-50";
  // Botón inactivo: superficie/borde del DS, hover visible.
  const inactiveBtn =
    "border border-border bg-transparent text-text hover:border-muted";

  return (
    <nav role="navigation" aria-label={t("paginationLabel")}>
      <ul className="flex items-center gap-2">
        {/* « Anterior — disabled en page 1 */}
        <li>
          <button
            type="button"
            className={cn(baseBtn, inactiveBtn)}
            disabled={currentPage === 1}
            aria-label={t("previous")}
            onClick={() => onPageChange(currentPage - 1)}
          >
            « <span className="hidden sm:inline">{t("previous")}</span>
          </button>
        </li>

        {/* Ventana numerada con elipsis */}
        {entries.map((entry, i) =>
          entry === ELLIPSIS ? (
            <li
              key={`ellipsis-${i}`}
              aria-hidden="true"
              className="inline-flex items-center justify-center min-w-10 h-10 text-muted select-none"
            >
              …
            </li>
          ) : (
            <li key={entry}>
              <button
                type="button"
                className={cn(
                  baseBtn,
                  entry === currentPage
                    ? // Activo: VARIABLE de acento del DS (legacy), texto on-accent.
                      // NUNCA hardcodear el hex. Usa bg-accent del DS.
                      "bg-accent text-white border border-accent"
                    : inactiveBtn
                )}
                aria-label={t("pageN", { n: entry })}
                aria-current={entry === currentPage ? "page" : undefined}
                onClick={() => onPageChange(entry)}
              >
                {entry}
              </button>
            </li>
          )
        )}

        {/* Siguiente » — disabled cuando !hasMore (gate de slice 1, NO totalPages) */}
        <li>
          <button
            type="button"
            className={cn(baseBtn, inactiveBtn)}
            data-testid="pagination-next"
            disabled={!hasMore}
            aria-label={t("next")}
            onClick={() => onPageChange(currentPage + 1)}
          >
            <span className="hidden sm:inline">{t("next")}</span> »
          </button>
        </li>
      </ul>
    </nav>
  );
}
