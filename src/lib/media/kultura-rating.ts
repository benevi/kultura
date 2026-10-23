// ============================================================
// KULTURA — Nota media de KULTURA de un título (DIS-5, CRE-3)
//
// La media de las notas (1-5) que la gente le ha puesto en su biblioteca, en
// la ficha pública. NO va al JSON-LD (`aggregateRating`): el plan lo excluye y
// Google lo exige con `offers` en algunos tipos.
//
// Privacidad (D-04): solo cuentan las bibliotecas PÚBLICAS
// (`users.library_visibility = 'public'`). Una biblioteca `friends` o
// `private` no aporta nada, ni siquiera dentro de una media: con pocas notas y
// una caché de una hora, la media antes y después de una nota nueva dejaría
// deducir la nota de alguien que no la ha hecho pública. Además:
//   - Se excluyen las cuentas de la demo (`app_metadata.demo`, la cuenta de
//     ejemplo y sus amigos sembrados): sus notas no son de nadie.
//   - Mínimo de `KULTURA_RATING_MIN_VOTES` notas.
//   - Antes de la migración de F-12 (`identity_privacy`) la columna no
//     existe: entonces no hay nota (nunca se cae a contar todas).
// Se calcula en el servidor con la clave de servicio porque un visitante
// anónimo no puede leer `user_media` (D-04a); solo salen dos números.
// ============================================================

import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createLogger } from "@/lib/logger";

const log = createLogger("media/kultura-rating");

export const KULTURA_RATING_MIN_VOTES = 5;
const REVALIDATE_SECONDS = 60 * 60;
const DEMO_IDS_REVALIDATE_SECONDS = 60 * 60 * 24;
/** Tope de filas leídas por título (sobra con mucho para una media). */
const MAX_ROWS = 5000;
const USERS_PAGE = 1000;

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

/** ¿Es el error de "esa columna no existe" (migración de F-12 sin aplicar)? */
function isMissingColumn(error: { code?: string; message?: string }): boolean {
  return error.code === "42703" || /library_visibility/.test(error.message ?? "");
}

/** Ids de las cuentas marcadas como demo (las únicas que lo saben es Auth). */
async function computeDemoUserIds(): Promise<string[]> {
  const admin = createAdminClient();
  const ids: string[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: USERS_PAGE });
    if (error) throw new Error(`listUsers: ${error.message}`);
    for (const u of data.users) if (u.app_metadata?.demo === true) ids.push(u.id);
    if (data.users.length < USERS_PAGE) break;
  }
  return ids;
}

const cachedDemoIds = unstable_cache(computeDemoUserIds, ["kultura-demo-ids-v1"], {
  revalidate: DEMO_IDS_REVALIDATE_SECONDS,
  tags: ["kultura-rating"],
});

type RatingRow = { score: unknown; user_id: string };

async function computeKulturaRating(
  mediaId: string,
  demoIds: () => Promise<string[]>
): Promise<KulturaRating | null> {
  const { data, error } = await createAdminClient()
    .from("user_media")
    .select("score, user_id, users!inner(library_visibility)")
    .eq("media_id", mediaId)
    .eq("users.library_visibility", "public")
    .not("score", "is", null)
    .limit(MAX_ROWS);
  if (error) {
    if (isMissingColumn(error)) return null;
    // Un error se lanza para que la caché no lo guarde; fuera queda en `null`.
    throw new Error(`user_media: ${error.message}`);
  }
  const rows = (data ?? []) as unknown as RatingRow[];
  // Sin notas suficientes ni siquiera hace falta preguntar por la demo.
  if (rows.length < KULTURA_RATING_MIN_VOTES) return null;
  const demo = new Set(await demoIds());
  return summarizeScores(rows.filter((r) => !demo.has(r.user_id)).map((r) => r.score));
}

const cached = unstable_cache(
  (mediaId: string) => computeKulturaRating(mediaId, cachedDemoIds),
  ["kultura-rating-v2"],
  { revalidate: REVALIDATE_SECONDS, tags: ["kultura-rating"] }
);

/** Nota media de KULTURA o `null` (pocas notas, sin columna, sin base o fuera de Next). Nunca lanza. */
export async function getKulturaRating(mediaId: string): Promise<KulturaRating | null> {
  try {
    return await cached(mediaId);
  } catch (e) {
    if (e instanceof Error && e.message.includes("incrementalCache missing")) {
      return computeKulturaRating(mediaId, computeDemoUserIds).catch(() => null);
    }
    log.warn("no se pudo calcular la nota media", { mediaId, err: e });
    return null;
  }
}
