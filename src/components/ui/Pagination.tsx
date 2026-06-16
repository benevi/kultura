"use client";

import { useTranslations } from "next-intl";
import { Button } from "./button";

export interface PaginationProps {
  currentPage: number;
  // E79 slice 1: gate de "next" basado en la FUENTE cruda, no en totalPages
  // (que sigue inflado por los post-filtros). El componente es prev/next, no
  // renderiza números, así que totalPages ya no se necesita.
  hasMore: boolean;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, hasMore, onPageChange }: PaginationProps) {
  const t = useTranslations("discover");

  return (
    <div className="flex items-center gap-4">
      <Button
        variant="outline"
        size="sm"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        ← {t("previous")}
      </Button>

      <span className="text-sm text-muted">
        {t("page")} {currentPage}
      </span>

      <Button
        variant="outline"
        size="sm"
        data-testid="pagination-next"
        disabled={!hasMore}
        onClick={() => onPageChange(currentPage + 1)}
      >
        {t("next")} →
      </Button>
    </div>
  );
}
