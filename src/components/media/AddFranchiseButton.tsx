"use client";

// ============================================================
// KULTURA — "Añadir toda la franquicia" (F-29)
//
// Añade a "Pendiente" los títulos de la franquicia que aún no están en la
// biblioteca, de uno en uno por `POST /api/library` (la misma ruta que el
// botón de la ficha: crea la fila del catálogo con los datos del proveedor).
// Los que ya están NO se tocan: un upsert les borraría la nota y el estado.
// La ruta admite 30 por minuto: si responde 429 se para y se puede seguir
// luego (lo añadido se queda). Textos desde el servidor (no hay namespace
// en el cliente de la ficha).
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KButton } from "@/components/ui/KButton";

export interface AddFranchiseLabels {
  addAll: string;
  /** Con `{done}` y `{total}`. */
  adding: string;
  /** Con `{count}` (singular y plural: el número no se sabe hasta el final). */
  addedOne: string;
  addedOther: string;
  rateLimited: string;
  failed: string;
}

interface Props {
  /** Ids de KULTURA que faltan en la biblioteca, en orden. */
  mediaIds: string[];
  labels: AddFranchiseLabels;
}

type Phase = { kind: "idle" } | { kind: "adding"; done: number } | { kind: "done"; added: number } | { kind: "error"; message: string };

const fill = (s: string, values: Record<string, number>) =>
  s.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));

export function AddFranchiseButton({ mediaIds, labels }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(mediaIds);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const busy = phase.kind === "adding";

  async function addAll() {
    const total = pending.length;
    const left = [...pending];
    let added = 0;
    let failed = 0;
    setPhase({ kind: "adding", done: 0 });
    while (left.length > 0) {
      const mediaId = left[0];
      let status = 0;
      try {
        const res = await fetch("/api/library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaId, status: "pending" }),
        });
        status = res.status;
      } catch {
        status = 0;
      }
      if (status === 429) {
        setPending(left);
        setPhase({ kind: "error", message: labels.rateLimited });
        if (added > 0) router.refresh();
        return;
      }
      left.shift();
      if (status >= 200 && status < 300) added++;
      else failed++;
      setPhase({ kind: "adding", done: total - left.length });
    }
    setPending([]);
    setPhase(failed > 0 && added === 0 ? { kind: "error", message: labels.failed } : { kind: "done", added });
    if (added > 0) router.refresh();
  }

  if (pending.length === 0 && phase.kind !== "done") return null;

  return (
    <div className="flex flex-col items-start gap-2">
      {pending.length > 0 && (
        <KButton size="sm" onClick={addAll} disabled={busy} aria-busy={busy}>
          {labels.addAll}
        </KButton>
      )}
      <p role="status" className="text-[13px] text-text-secondary">
        {phase.kind === "adding" && fill(labels.adding, { done: phase.done, total: pending.length })}
        {phase.kind === "done" &&
          fill(phase.added === 1 ? labels.addedOne : labels.addedOther, { count: phase.added })}
        {phase.kind === "error" && phase.message}
      </p>
    </div>
  );
}
