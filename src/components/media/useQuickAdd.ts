"use client";

// ============================================================
// KULTURA — Añadir en un toque (fase 8.2, bandera QUICK_ADD): el
// comportamiento, sin el botón. Lo comparten `QuickAddButton` (Descubrir de
// hoy) y `SalaDiscoverQuickAdd` (Descubrir en «Sala», fase 8.5 D1), cada uno
// con su zona de avisos (`useToastContext` o `useSalaToast`, misma API).
//
// Guarda el título como Pendiente con POST /api/library/bulk de un solo id:
// el servidor SOLO INSERTA, así que si ya estaba en la biblioteca no se le
// toca estado, nota ni progreso. El aviso trae «Deshacer», que lo quita solo
// si de verdad se añadió ahora.
// ============================================================

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ApiError, apiFetch } from "@/lib/api/client";
import type { LibraryBulkResult } from "@/lib/api/contracts/library";
import { removeFromLibrary } from "@/lib/library/actions";

export type QuickAddPhase = "idle" | "saving" | "inLibrary";

/** Lo que el hook necesita de la zona de avisos (la de hoy y la de «Sala» lo tienen). */
export interface QuickAddToasts {
  show: (payload: {
    message: string;
    type?: "success" | "error" | "info";
    action?: { label: string; onAction: () => void };
  }) => void;
  showError: (message: string) => void;
}

export function useQuickAdd(mediaId: string, title: string, toasts: QuickAddToasts) {
  const t = useTranslations("library");
  const { show, showError } = toasts;
  const [phase, setPhase] = useState<QuickAddPhase>("idle");
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
  return {
    phase,
    inLibrary,
    add,
    /** Nombre accesible del botón: «Añadir X a Pendiente» o «X ya está en tu biblioteca». */
    label: inLibrary ? t("quickInLibrary", { title }) : t("quickAdd", { title }),
  };
}
