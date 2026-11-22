"use client";

// ============================================================
// KULTURA — "Añadir toda la franquicia" (F-29, PRO-11)
// Añade como Pendiente, EN UNA PETICIÓN (POST /api/library/bulk, saneamiento
// 6.4), los títulos de la sección que aún no están en la biblioteca. El
// servidor SOLO INSERTA: lo que ya esté (también si entró entretanto desde
// otra pestaña) conserva estado, nota y progreso. Antes eran N POST
// /api/library uno a uno con comprobaciones en el navegador.
// Con un 429 espera lo que diga `Retry-After` (como mucho una vez y 60 s) y,
// si sigue, para y lo dice. Los títulos cuya ficha no da el proveedor quedan
// para reintentar. El resultado se anuncia en una región `aria-live`; al
// terminar se refresca la ficha para que salga "En tu biblioteca".
// ============================================================

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { KButton } from "@/components/ui/KButton";
import { ApiError, apiFetch } from "@/lib/api/client";
import type { LibraryBulkResult } from "@/lib/api/contracts/library";

export interface FranchiseItem {
  mediaId: string;
  title: string;
}

type Phase =
  | { kind: "idle" }
  | { kind: "running"; total: number }
  | { kind: "waiting"; seconds: number }
  | { kind: "done"; count: number }
  | { kind: "partial"; done: number; total: number }
  | { kind: "rateLimited" }
  | { kind: "allIn" }
  | { kind: "error" };

/** Espera máxima ante un 429 antes de rendirse. */
const MAX_RETRY_AFTER_S = 60;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function addBulk(mediaIds: string[]): Promise<LibraryBulkResult> {
  return apiFetch<LibraryBulkResult>("/api/library/bulk", { method: "POST", json: { mediaIds } });
}

export function AddFranchiseButton({ items }: { items: FranchiseItem[] }) {
  const t = useTranslations("adaptations.add");
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [remaining, setRemaining] = useState(items);
  const running = useRef(false);

  async function run() {
    if (running.current || remaining.length === 0) return;
    running.current = true;
    const total = remaining.length;
    setPhase({ kind: "running", total });

    let result: LibraryBulkResult | null = null;
    let outcome: Phase | null = null;
    for (let attempt = 0; attempt < 2 && !result && !outcome; attempt++) {
      try {
        result = await addBulk(remaining.map((i) => i.mediaId));
      } catch (e) {
        const err = e instanceof ApiError ? e : null;
        if (err?.status === 429) {
          if (attempt === 0 && err.retryAfter > 0 && err.retryAfter <= MAX_RETRY_AFTER_S) {
            setPhase({ kind: "waiting", seconds: err.retryAfter });
            await sleep(err.retryAfter * 1000);
            setPhase({ kind: "running", total });
            continue;
          }
          outcome = { kind: "rateLimited" };
        } else {
          outcome = { kind: "error" };
        }
      }
    }
    running.current = false;

    if (!result) {
      setPhase(outcome ?? { kind: "error" });
      return;
    }
    // Quedan solo los que el proveedor no dio: se pueden reintentar.
    const failed = new Set(result.failed);
    setRemaining(remaining.filter((i) => failed.has(i.mediaId)));
    const done = result.added.length;
    setPhase(
      failed.size > 0
        ? done > 0
          ? { kind: "partial", done, total }
          : { kind: "error" }
        : done > 0
          ? { kind: "done", count: done }
          : { kind: "allIn" }
    );
    if (done > 0) router.refresh();
  }

  const busy = phase.kind === "running" || phase.kind === "waiting";
  const message =
    phase.kind === "running"
      ? t("progress", { total: phase.total })
      : phase.kind === "waiting"
        ? t("waiting", { seconds: phase.seconds })
        : phase.kind === "done"
          ? t("done", { count: phase.count })
          : phase.kind === "partial"
            ? t("partial", { done: phase.done, total: phase.total })
            : phase.kind === "rateLimited"
              ? t("rateLimited")
              : phase.kind === "allIn"
                ? t("allIn")
              : phase.kind === "error"
                ? t("error")
                : "";

  return (
    <div className="flex flex-col items-start gap-1.5">
      {remaining.length > 0 && phase.kind !== "done" && phase.kind !== "allIn" && (
        <>
          <KButton type="button" variant="secondary" size="md" onClick={run} loading={busy} aria-describedby="franchise-hint">
            <span aria-hidden="true">+</span> {t("action")}
          </KButton>
          <p id="franchise-hint" className="text-xs text-text-tertiary">
            {t("hint", { count: remaining.length })}
          </p>
        </>
      )}
      <p role="status" aria-live="polite" className="text-xs font-bold text-text-secondary min-h-4">
        {message}
      </p>
    </div>
  );
}
