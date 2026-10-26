// ============================================================
// KULTURA — Nota compartida: firma y datos (F-29). SOLO SERVIDOR.
//
// `/{locale}/u/{usuario}/r/{tipo}/{id}?s={firma}` enseña "benevi le da 9/10 a
// Dune" a cualquiera, también sin cuenta. Pero la biblioteca y sus notas son
// privadas por defecto ("Sin cuenta no la ve nadie", Ajustes): sin firma, una
// URL inventada (/u/ana/r/movie/550) revelaría la nota de cualquiera. Por eso
// la nota solo sale con la firma que el servidor genera PARA EL DUEÑO cuando
// pulsa "Compartir mi nota" en la ficha (compartirla es su decisión). Sin
// firma válida, la página lleva a la ficha y la tarjeta no lleva nota.
//
// La firma no caduca (un post en redes vive años) y se ata a usuario +
// título; la nota que se enseña es la de ahora: si la cambia, cambia; si la
// quita o saca el título de la biblioteca, el enlace deja de enseñar nada.
// La nota se lee con el service role SOLO tras validar la firma.
// ============================================================

import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseMediaId } from "@/lib/media/media-id";

const MAC_HEX = 32;
const SIG_RE = /^[0-9a-f]{32}$/;
const NOT_MIGRATED = new Set(["42703", "PGRST204"]);

/** Clave: `SHARE_SECRET`, si no `INVITE_SECRET`, si no la del service role. */
function shareSecret(): string | null {
  return (
    process.env.SHARE_SECRET?.trim() ||
    process.env.INVITE_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    null
  );
}

function mac(secret: string, userId: string, mediaId: string): string {
  return createHmac("sha256", secret).update(`kultura-rating:v1|${userId}|${mediaId}`).digest("hex").slice(0, MAC_HEX);
}

export function ratingShareSignature(userId: string, mediaId: string): string | null {
  const secret = shareSecret();
  if (!secret || !userId || !parseMediaId(mediaId)) return null;
  return mac(secret, userId, mediaId);
}

export function isValidRatingShareSignature(userId: string, mediaId: string, sig: string | null | undefined): boolean {
  const secret = shareSecret();
  if (!secret || !userId || !sig || !SIG_RE.test(sig)) return false;
  const expected = Buffer.from(mac(secret, userId, mediaId), "utf8");
  const given = Buffer.from(sig, "utf8");
  return expected.byteLength === given.byteLength && timingSafeEqual(expected, given);
}

/** Ruta para compartir la nota (sin origen). `null` sin clave o con un id imposible. */
export function ratingSharePath(locale: string, user: { id: string; username: string }, mediaId: string): string | null {
  const parsed = parseMediaId(mediaId);
  const sig = ratingShareSignature(user.id, mediaId);
  if (!parsed || !sig || !user.username) return null;
  return `/${locale}/u/${encodeURIComponent(user.username)}/r/${parsed.type}/${encodeURIComponent(parsed.externalId)}?s=${sig}`;
}

/** Nota 0,5-10 de la fila (`rating10`, o `score × 2` antes de la migración de F-24). */
export function rating10Of(row: { rating10?: number | string | null; score?: number | null } | null): number | null {
  if (!row) return null;
  const r = row.rating10 === null || row.rating10 === undefined ? null : Number(row.rating10);
  if (r !== null && Number.isFinite(r) && r >= 0.5 && r <= 10) return r;
  return typeof row.score === "number" && row.score >= 1 && row.score <= 5 ? row.score * 2 : null;
}

export interface SharedRating {
  owner: { id: string; username: string };
  rating10: number;
}

/** Lo mínimo de Supabase que usa la lectura (inyectable en tests). */
type Reader = {
  from(table: string): {
    select(cols: string): {
      eq(col: string, value: string): {
        eq(col: string, value: string): { maybeSingle(): PromiseLike<{ data: unknown; error: { code?: string } | null }> };
        maybeSingle(): PromiseLike<{ data: unknown; error: { code?: string } | null }>;
      };
    };
  };
};

export interface SharedRatingDeps {
  publicClient?: Reader;
  adminClient?: Reader;
}

/**
 * Dueño y nota de una nota compartida, o `null` si el usuario no existe, la
 * firma no vale, o ya no hay nota. Nunca lanza.
 */
export async function loadSharedRating(
  username: string,
  mediaId: string,
  sig: string | null | undefined,
  deps: SharedRatingDeps = {},
): Promise<SharedRating | null> {
  if (!sig || !SIG_RE.test(sig) || !parseMediaId(mediaId)) return null;
  try {
    const pub = deps.publicClient ?? ((await createClient()) as unknown as Reader);
    const { data: owner } = await pub.from("users").select("id, username").eq("username", username).maybeSingle();
    const o = owner as { id: string; username: string } | null;
    if (!o || !isValidRatingShareSignature(o.id, mediaId, sig)) return null;

    const admin = deps.adminClient ?? (createAdminClient() as unknown as Reader);
    const read = (cols: string) =>
      admin.from("user_media").select(cols).eq("user_id", o.id).eq("media_id", mediaId).maybeSingle();
    let { data, error } = await read("rating10, score");
    if (error && NOT_MIGRATED.has(error.code ?? "")) ({ data, error } = await read("score"));
    if (error) return null;
    const rating10 = rating10Of(data as { rating10?: number | null; score?: number | null } | null);
    return rating10 === null ? null : { owner: { id: o.id, username: o.username }, rating10 };
  } catch {
    return null;
  }
}

/** "9" / "8,5" (es) / "8.5" (en). */
export function formatRating10(rating10: number, locale: string): string {
  return new Intl.NumberFormat(locale === "en" ? "en" : "es", { maximumFractionDigits: 1 }).format(rating10);
}
