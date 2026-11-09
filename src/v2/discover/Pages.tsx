"use client";

import { useTranslations } from "next-intl";
import { buildPageWindow, ELLIPSIS } from "@/components/ui/Pagination";

// Misma ventana y misma puerta que la paginación vieja: «Siguiente» depende de
// `hasMore`, no del total, que con post-filtros no es fiable.
export function Pages({
  page,
  hasMore,
  totalPages,
  busy,
  onChange,
}: {
  page: number;
  hasMore: boolean;
  totalPages: number | null;
  /** Con la página pidiéndose, un segundo clic saltaría otra. */
  busy: boolean;
  onChange: (page: number) => void;
}) {
  const t = useTranslations("discover");
  const entries = buildPageWindow(page, totalPages);

  return (
    <nav className="k2d-pages" aria-label={t("paginationLabel")}>
      <button type="button" className="k2d-pages__step" disabled={busy || page === 1} onClick={() => onChange(page - 1)}>
        {t("previous")}
      </button>
      <ul>
        {entries.map((entry, i) =>
          entry === ELLIPSIS ? (
            <li key={`e${i}`} aria-hidden="true" className="k2d-pages__gap">
              …
            </li>
          ) : (
            <li key={entry}>
              <button
                type="button"
                aria-label={t("pageN", { n: entry })}
                aria-current={entry === page ? "page" : undefined}
                disabled={busy}
                onClick={() => onChange(entry)}
              >
                {entry}
              </button>
            </li>
          )
        )}
      </ul>
      <button
        type="button"
        className="k2d-pages__step"
        data-testid="pagination-next"
        disabled={busy || !hasMore}
        onClick={() => onChange(page + 1)}
      >
        {t("next")}
      </button>
    </nav>
  );
}
