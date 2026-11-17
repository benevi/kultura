"use client";

// ============================================================
// KULTURA — Añadir en un toque desde Descubrir (fase 8.2, bandera QUICK_ADD)
// Botón «+» sobre la portada de la tarjeta, FUERA de su enlace (un botón
// dentro de un enlace no es HTML válido). Guarda el título como Pendiente con
// POST /api/library/bulk de un solo id: el servidor SOLO INSERTA, así que si
// ya estaba en la biblioteca no se le toca estado, nota ni progreso.
// El aviso trae «Deshacer», que lo quita solo si de verdad se añadió ahora.
// ============================================================

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ApiError, apiFetch } from "@/lib/api/client";
import type { LibraryBulkResult } from "@/lib/api/contracts/library";
import { removeFromLibrary } from "@/lib/library/actions";
import { useToastContext } from "@/components/ui/ToastProvider";
import { IconCheck } from "@/components/icons";
import { cn } from "@/lib/utils/index";

type Phase = "idle" | "saving" | "inLibrary";

export interface QuickAddButtonProps {
  mediaId: string;
  title: string;
  className?: string;
}

export function QuickAddButton({ mediaId, title, className }: QuickAddButtonProps) {
  const t = useTranslations("library");
  const { show, showError } = useToastContext();
  const [phase, setPhase] = useState<Phase>("idle");
  const busy = useRef(false);

  async function undo() {
    try {
      await removeFromLibrary(mediaId);
      setPhase("idle");
    } catch {
      showError(t("errors.removeFailed"));
    }
  }

  async function add() {
    if (busy.current || phase !== "idle") return;
    busy.current = true;
    setPhase("saving");
    try {
      const result = await apiFetch<LibraryBulkResult>("/api/library/bulk", {
        method: "POST",
        json: { mediaIds: [mediaId] },
      });
      if (result.added.includes(mediaId)) {
        setPhase("inLibrary");
        show({
          message: t("quickAdded", { title }),
          type: "success",
          action: { label: t("undo"), onAction: () => void undo() },
        });
      } else if (result.skipped.includes(mediaId)) {
        setPhase("inLibrary");
        show({ message: t("quickAlready", { title }), type: "info" });
      } else {
        setPhase("idle");
        showError(t("quickAddFailed"));
      }
    } catch (e) {
      setPhase("idle");
      showError(e instanceof ApiError && e.status === 429 ? t("quickAddRateLimited") : t("quickAddFailed"));
    } finally {
      busy.current = false;
    }
  }

  const inLibrary = phase === "inLibrary";
  return (
    <button
      type="button"
      onClick={add}
      aria-label={inLibrary ? t("quickInLibrary", { title }) : t("quickAdd", { title })}
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
