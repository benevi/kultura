// ============================================================
// KULTURA — Caché de adaptaciones en la tabla `media_adaptations` (F-29)
//
// Migración 20261215290001_adaptations.sql: lectura para cualquiera y
// escritura solo del service role. Aquí se usa siempre el cliente admin (solo
// servidor): el cargador corre también fuera de una petición con cookies.
//
// Antes de aplicar la migración la tabla no existe (42P01 / PGRST205): se
// devuelve `missing` y quien llama guarda en la caché de datos de Next.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createLogger } from "@/lib/logger";
import { isAdaptationLink, type AdaptationLink } from "./map";

const log = createLogger("adaptations/store");

export type AdaptationStatus = "ok" | "not_found" | "partial";

export interface StoredAdaptations {
  subjectQid: string | null;
  links: AdaptationLink[];
  status: AdaptationStatus;
  fetchedAt: string;
  expiresAt: string;
}

export type StoreRead =
  | { kind: "missing" }
  | { kind: "error" }
  | { kind: "empty" }
  | { kind: "hit"; row: StoredAdaptations; fresh: boolean };

/** "Esta tabla no existe todavía" (migración sin aplicar). */
const TABLE_MISSING = new Set(["42P01", "PGRST205"]);

type Row = {
  subject_qid: string | null;
  links: unknown;
  status: string;
  fetched_at: string;
  expires_at: string;
};

function admin(): SupabaseClient | null {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

function toStatus(value: unknown): AdaptationStatus {
  return value === "not_found" || value === "partial" ? value : "ok";
}

export async function readStoredAdaptations(mediaId: string, now = Date.now()): Promise<StoreRead> {
  const client = admin();
  if (!client) return { kind: "error" };
  try {
    const { data, error } = await client
      .from("media_adaptations")
      .select("subject_qid, links, status, fetched_at, expires_at")
      .eq("media_id", mediaId)
      .maybeSingle();
    if (error) {
      if (TABLE_MISSING.has(error.code ?? "")) return { kind: "missing" };
      log.warn("no se pudo leer la caché de adaptaciones", { mediaId, code: error.code });
      return { kind: "error" };
    }
    if (!data) return { kind: "empty" };
    const row = data as Row;
    const links = Array.isArray(row.links) ? row.links.filter(isAdaptationLink) : [];
    const expires = Date.parse(row.expires_at);
    return {
      kind: "hit",
      fresh: Number.isFinite(expires) && expires > now,
      row: {
        subjectQid: row.subject_qid,
        links,
        status: toStatus(row.status),
        fetchedAt: row.fetched_at,
        expiresAt: row.expires_at,
      },
    };
  } catch (e) {
    log.warn("no se pudo leer la caché de adaptaciones", { mediaId, err: e });
    return { kind: "error" };
  }
}

/** Guarda (o sustituye) la fila. Nunca lanza: si falla, la ficha sigue igual. */
export async function writeStoredAdaptations(
  mediaId: string,
  value: Omit<StoredAdaptations, "fetchedAt" | "expiresAt">,
  ttlSeconds: number,
  now = Date.now()
): Promise<boolean> {
  const client = admin();
  if (!client) return false;
  try {
    const { error } = await client.from("media_adaptations").upsert(
      {
        media_id: mediaId,
        subject_qid: value.subjectQid,
        links: value.links,
        status: value.status,
        fetched_at: new Date(now).toISOString(),
        expires_at: new Date(now + ttlSeconds * 1000).toISOString(),
      },
      { onConflict: "media_id" }
    );
    if (error) {
      if (!TABLE_MISSING.has(error.code ?? "")) {
        log.warn("no se pudo guardar la caché de adaptaciones", { mediaId, code: error.code });
      }
      return false;
    }
    return true;
  } catch (e) {
    log.warn("no se pudo guardar la caché de adaptaciones", { mediaId, err: e });
    return false;
  }
}
