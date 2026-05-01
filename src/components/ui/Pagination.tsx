"use client";

import { useTranslations } from "next-intl";
import { Button } from "./button";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
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
        {t("page")} {currentPage} {t("of")} {totalPages}
      </span>

      <Button
        variant="outline"
        size="sm"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        {t("next")} →
      </Button>
    </div>
  );
}
