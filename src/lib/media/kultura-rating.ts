// ============================================================
// KULTURA — Nota media de KULTURA de un título (DIS-5, CRE-3)
//
// La media de las notas (1-5) que la gente le ha puesto en su biblioteca. Es
// la ÚNICA nota que la ficha publica como `aggregateRating` en el JSON-LD:
// marcar con la del proveedor es marcado engañoso para Google (VERIF-C).
//
// Privacidad: solo se publica un agregado (media con un decimal y número de
// notas) y solo a partir de `KULTURA_RATING_MIN_VOTES` notas, para que la
// media no sea la nota de una persona concreta. Se calcula en el servidor con
// la clave de servicio porque un visitante anónimo no puede leer
// `user_media` (D-04a); nunca sale ninguna fila, solo los dos números.
// Se guarda una hora en la caché de datos: una consulta por título y hora.
// ============================================================

import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createLogger } from "@/lib/logger";

const log = createLogger("media/kultura-rating");

export const KULTURA_RATING_MIN_VOTES = 3;
const REVALIDATE_SECONDS = 60 * 60;
/** Tope de filas leídas por título (sobra con mucho para una media). */
const MAX_ROWS = 5000;

export interface KulturaRating {
  /** Media 1-5 con un decimal. */
  value: number;
  count: number;
}

/** Media de una lista de notas 1-5; `null` si no llega al mínimo. */
export function summarizeScores(scores: readonly unknown[]): KulturaRating | null {
  const valid = scores.filter(
    (s): s is number => typeof s === "number" && Number.isFinite(s) && s >= 1 && s <= 5
  );
  if (valid.length < KULTURA_RATING_MIN_VOTES) return null;
  const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
  return { value: Math.round(avg * 10) / 10, count: valid.length };
}

async function computeKulturaRating(mediaId: string): Promise<KulturaRating | null> {
  const { data, error } = await createAdminClient()
    .from("user_media")
    .select("score")
    .eq("media_id", mediaId)
    .not("score", "is", null)
    .limit(MAX_ROWS);
  // Un error se lanza para que la caché no lo guarde; fuera queda en `null`.
  if (error) throw new Error(`user_media: ${error.message}`);
  return summarizeScores((data ?? []).map((row) => (row as { score: unknown }).score));
}

const cached = unstable_cache(computeKulturaRating, ["kultura-rating-v1"], {
  revalidate: REVALIDATE_SECONDS,
  tags: ["kultura-rating"],
});

/** Nota media de KULTURA o `null` (pocas notas, sin base o fuera de Next). Nunca lanza. */
export async function getKulturaRating(mediaId: string): Promise<KulturaRating | null> {
  try {
    return await cached(mediaId);
  } catch (e) {
    if (e instanceof Error && e.message.includes("incrementalCache missing")) {
      return computeKulturaRating(mediaId).catch(() => null);
    }
    log.warn("no se pudo calcular la nota media", { mediaId, err: e });
    return null;
  }
}
