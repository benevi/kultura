"use client";

// ============================================================
// KULTURA — Añadir en un toque desde Descubrir (fase 8.2, bandera QUICK_ADD)
// Botón «+» sobre la portada de la tarjeta, FUERA de su enlace (un botón
// dentro de un enlace no es HTML válido). El comportamiento (guardar como
// Pendiente, aviso con «Deshacer») vive en `useQuickAdd`.
// ============================================================

import { useToastContext } from "@/components/ui/ToastProvider";
import { IconCheck } from "@/components/icons";
import { cn } from "@/lib/utils/index";
import { useQuickAdd } from "./useQuickAdd";

export interface QuickAddButtonProps {
  mediaId: string;
  title: string;
  className?: string;
}

export function QuickAddButton({ mediaId, title, className }: QuickAddButtonProps) {
  const { phase, inLibrary, add, label } = useQuickAdd(mediaId, title, useToastContext());
  return (
    <button
      type="button"
      onClick={add}
      aria-label={label}
      aria-disabled={phase !== "idle"}
      data-testid="quick-add"
      data-state={phase}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-full border border-surface-border bg-surface-base/80 text-xl font-bold leading-none text-text-primary backdrop-blur-sm transition-colors",
        "hover:bg-surface-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-info",
        inLibrary && "text-accent-positive",
        phase === "saving" && "opacity-60",
        className
      )}
    >
      {inLibrary ? <IconCheck className="h-5 w-5" aria-hidden="true" /> : <span aria-hidden="true">+</span>}
    </button>
  );
}
