"use client";

// ============================================================
// KULTURA — "Añadir toda la franquicia" (F-29, PRO-11)
// Añade como Pendiente, UNO A UNO, los títulos de la sección que aún no están
// en la biblioteca. SOLO INSERTA: el POST de /api/library es un upsert que
// pisaría estado y nota, así que la lista del servidor (ya filtrada) se vuelve
// a comprobar en el navegador contra la biblioteca de quien pulsa (RLS: su
// sesión), al empezar y justo antes de cada título; lo que ya esté (añadido en
// otra pestaña entretanto) se salta, y si no se puede comprobar no se envía
// nada. Va por el mismo POST /api/library que el resto de la app,
// así que respeta su límite (30/min por usuario): con un 429 espera lo que
// diga `Retry-After` (como mucho una vez y 60 s) y, si sigue, para y lo dice.
// El progreso se anuncia en una región `aria-live`; al terminar se refresca la
// ficha para que salga "En tu biblioteca".
// ============================================================

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { KButton } from "@/components/ui/KButton";
import { createClient } from "@/lib/supabase/client";

export interface FranchiseItem {
  mediaId: string;
  title: string;
}

type Phase =
  | { kind: "idle" }
  | { kind: "running"; done: number; total: number }
  | { kind: "waiting"; seconds: number }
  | { kind: "done"; count: number }
  | { kind: "partial"; done: number; total: number }
  | { kind: "rateLimited" }
  | { kind: "allIn" }
  | { kind: "error" };

/** Pausa entre peticiones: no hace falta correr y así no se pisa con otras acciones. */
export const FRANCHISE_ADD_GAP_MS = 250;
/** Espera máxima ante un 429 antes de rendirse. */
const MAX_RETRY_AFTER_S = 60;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function addOne(mediaId: string): Promise<{ ok: true } | { ok: false; status: number; retryAfter: number }> {
  try {
    const res = await fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaId, status: "pending" }),
    });
    if (res.ok) return { ok: true };
    const retryAfter = Number(res.headers.get("Retry-After"));
    return { ok: false, status: res.status, retryAfter: Number.isFinite(retryAfter) ? retryAfter : 0 };
  } catch {
    return { ok: false, status: 0, retryAfter: 0 };
  }
}

/**
 * Cuáles de `mediaIds` están YA en la biblioteca de `userId` (lectura con la
 * sesión del navegador; la RLS deja leer también las de amigos, de ahí el
 * filtro por usuario). `null` si no se puede saber: entonces no se añade.
 */
export async function ownedMediaIds(userId: string, mediaIds: string[]): Promise<Set<string> | null> {
  try {
    const { data, error } = await createClient()
      .from("user_media")
      .select("media_id")
      .eq("user_id", userId)
      .in("media_id", mediaIds);
    if (error) return null;
    return new Set(((data ?? []) as { media_id: string }[]).map((r) => r.media_id));
  } catch {
    return null;
  }
}

export function AddFranchiseButton({ items, userId }: { items: FranchiseItem[]; userId: string }) {
  const t = useTranslations("adaptations.add");
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [remaining, setRemaining] = useState(items);
  const running = useRef(false);

  async function run() {
    if (running.current || remaining.length === 0) return;
    running.current = true;
    let outcome: Phase | null = null;
    const owned = await ownedMediaIds(userId, remaining.map((i) => i.mediaId));
    const queue = owned ? remaining.filter((i) => !owned.has(i.mediaId)) : [];
    if (!owned) outcome = { kind: "error" };
    const total = queue.length;
    let done = 0;
    let retried = false;
    let failed = 0;
    if (owned) setPhase({ kind: "running", done, total });

    while (!outcome && queue.length > 0) {
      const item = queue[0];
      // Justo antes de enviar: ¿ha entrado entretanto? (otra pestaña, la ficha…)
      const now = await ownedMediaIds(userId, [item.mediaId]);
      if (!now) {
        outcome = { kind: "error" };
        break;
      }
      if (now.has(item.mediaId)) {
        queue.shift();
        continue;
      }
      const result = await addOne(item.mediaId);
      if (result.ok) {
        queue.shift();
        done++;
        setPhase({ kind: "running", done, total });
        if (queue.length > 0) await sleep(FRANCHISE_ADD_GAP_MS);
        continue;
      }
      if (result.status === 429 && !retried && result.retryAfter > 0 && result.retryAfter <= MAX_RETRY_AFTER_S) {
        retried = true;
        setPhase({ kind: "waiting", seconds: result.retryAfter });
        await sleep(result.retryAfter * 1000);
        setPhase({ kind: "running", done, total });
        continue;
      }
      if (result.status === 429) outcome = { kind: "rateLimited" };
      else if (result.status === 401 || result.status === 403) outcome = { kind: "error" };
      else {
        // Un título que el proveedor no da (404/502) no para a los demás.
        queue.shift();
        failed++;
        continue;
      }
      break;
    }

    // Sin poder comprobar la biblioteca no se ha enviado nada: la lista sigue.
    if (owned) setRemaining(queue);
    running.current = false;
    // Cola vacía: terminado (los que el proveedor no dio se saltan; los que ya
    // estaban, también). Cortado a medias: cuántos sí y que se puede seguir.
    if (!outcome) {
      outcome = done > 0 ? { kind: "done", count: done } : failed > 0 ? { kind: "error" } : { kind: "allIn" };
    } else if (done > 0) outcome = { kind: "partial", done, total };
    setPhase(outcome);
    if (done > 0) router.refresh();
  }

  const busy = phase.kind === "running" || phase.kind === "waiting";
  const message =
    phase.kind === "running"
      ? t("progress", { done: phase.done, total: phase.total })
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
      {remaining.length > 0 && phase.kind !== "done" && (
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
