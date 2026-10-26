// ============================================================
// KULTURA — "benevi le da 9/10 a Dune" (CRE-8a, F-29). SOLO SERVIDOR.
//
// Página `/[locale]/u/[username]/r/[type]/[id]` y su tarjeta OG. La nota es
// parte de la BIBLIOTECA, y Ajustes promete "Sin cuenta no la ve nadie"
// (D-04a/b). Por eso la nota solo se enseña a quien ya puede verla o a quien
// el DUEÑO se la ha enseñado a propósito:
//
//   - el propio dueño, siempre;
//   - con sesión y sin bloqueo entre los dos: si `can_read_library` lo deja
//     (la RLS decide la lectura con la sesión de quien mira);
//   - con el ENLACE FIRMADO que genera la ficha para su dueño (`?s=`): es el
//     consentimiento de compartir ESA nota, también sin cuenta y en la
//     tarjeta OG. Nunca si la biblioteca está en "Solo yo" ni si hay bloqueo;
//   - sin cuenta y sin firma, solo con `SHARE_PUBLIC_LIBRARY=1` y biblioteca
//     "pública" (apagado: hoy "pública" es "cualquiera CON cuenta").
// En cualquier otro caso: tarjeta GENÉRICA (el título y el perfil, sin nota),
// idéntica tenga o no nota, para no filtrar nada por diferencia. 404 solo si
// no existe el usuario o el título.
//
// La firma es HMAC-SHA256 de `dueño|título` (no caduca: lo publicado en redes
// sigue funcionando; poner la biblioteca en "Solo yo" o rotar
// `SHARE_SECRET` lo corta). Las lecturas sin sesión van con el cliente admin
// SOLO después de pasar estas comprobaciones, y solo de esa fila.
// ============================================================

import * as React from "react";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseMediaId, type ParsedMediaId } from "@/lib/media/media-id";
import { loadMediaDetail } from "@/lib/media/detail-data";
import { entryRating10, isValidRating10 } from "@/lib/library/rating";
import { ratingScale10Enabled, readRatingScale } from "@/lib/library/scale";
import { viewerCanReadLibrary, type LibraryVisibility } from "@/lib/social/public-collection";
import type { MediaType } from "@/types/media";
import type { RatingScale } from "@/types/library";

export const SHARE_SIG_PARAM = "s";
/** 128 bits de HMAC en base64url. */
const SIG_LENGTH = 22;
const SIG_RE = /^[A-Za-z0-9_-]{22}$/;

/** Códigos de "esto aún no existe" (tabla, columna o función sin migrar). */
const NOT_MIGRATED = new Set(["42P01", "42703", "42883", "PGRST202", "PGRST204", "PGRST205"]);

const dedupe: <T extends (...args: never[]) => unknown>(fn: T) => T =
  (React as unknown as { cache?: <T>(fn: T) => T }).cache ?? ((fn) => fn);

// ── Firma ─────────────────────────────────────────────────────────────────────

function shareSecret(): string | null {
  return (
    process.env.SHARE_SECRET?.trim() ||
    process.env.INVITE_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    null
  );
}

/** Firma del enlace de la nota de `ownerId` sobre `mediaId`, o `null` sin clave. */
export function ratingShareSignature(ownerId: string, mediaId: string): string | null {
  const secret = shareSecret();
  if (!secret || !ownerId || !mediaId) return null;
  return createHmac("sha256", secret)
    .update(`kultura-rating-share:v1|${ownerId}|${mediaId}`)
    .digest("base64url")
    .slice(0, SIG_LENGTH);
}

/** ¿Es `sig` la firma de esa nota? Comparación de tiempo constante. */
export function isValidRatingShareSignature(ownerId: string, mediaId: string, sig: unknown): boolean {
  if (typeof sig !== "string" || !SIG_RE.test(sig)) return false;
  const expected = ratingShareSignature(ownerId, mediaId);
  if (!expected) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Ruta de la página de la nota, sin idioma (para `Link`) ni dominio. */
export function ratingPagePath(username: string, type: MediaType, externalId: string): string {
  return `/u/${encodeURIComponent(username)}/r/${type}/${encodeURIComponent(externalId)}`;
}

/**
 * Enlace firmado para que el dueño comparta su nota (lo genera la ficha).
 * Lleva `ref` (CRE-8, D-12): un alta desde ahí se atribuye a quien compartió.
 */
export function ratingSharePath(
  owner: { id: string; username: string },
  type: MediaType,
  externalId: string
): string | null {
  const sig = ratingShareSignature(owner.id, `${type}_${externalId}`);
  if (!sig) return null;
  const query = new URLSearchParams({ [SHARE_SIG_PARAM]: sig, ref: owner.username });
  return `${ratingPagePath(owner.username, type, externalId)}?${query}`;
}

// ── Formato de la nota ────────────────────────────────────────────────────────

export type ShareScale = RatingScale | "legacy";

export interface ShareRating {
  rating10: number;
  scale: ShareScale;
  /** "9/10", "4,5★" o, sin la escala fina, "4★". */
  text: string;
}

/**
 * Texto de la nota según la escala de su dueño: sobre 10 ("9/10"), medias
 * estrellas ("4,5★") o, sin `RATING_SCALE_10`, la nota entera de siempre.
 */
export function formatShareRating(
  entry: { rating10?: number | null; score: number | null },
  scale: ShareScale,
  locale: string
): ShareRating | null {
  const rating10 = entryRating10(entry);
  if (rating10 === null) return null;
  const fmt = new Intl.NumberFormat(locale === "en" ? "en" : "es", { maximumFractionDigits: 1 });
  if (scale === "ten") return { rating10, scale, text: `${fmt.format(rating10)}/10` };
  if (scale === "stars") return { rating10, scale, text: `${fmt.format(rating10 / 2)}★` };
  const score = typeof entry.score === "number" ? entry.score : Math.max(1, Math.round(rating10 / 2));
  return { rating10, scale, text: `${score}★` };
}

// ── Lecturas ─────────────────────────────────────────────────────────────────

export interface ShareOwner {
  id: string;
  username: string;
  avatarColor: string;
  avatarInitials: string;
  /** `null`: columna sin migrar (se trata como el valor por defecto, "amigos"). */
  libraryVisibility: LibraryVisibility | null;
}

function admin(): SupabaseClient | null {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

function toVisibility(value: unknown): LibraryVisibility | null {
  return value === "public" || value === "friends" || value === "private" ? value : null;
}

/** Dueño por nombre exacto, con su visibilidad (columna que anon no puede leer). */
export const findShareOwner = dedupe(async (username: string): Promise<ShareOwner | null> => {
  const client = admin();
  if (!client || !username || username.length > 40) return null;
  const read = (columns: string) => client.from("users").select(columns).eq("username", username).maybeSingle();
  let { data, error } = await read("id, username, avatar_color, avatar_initials, library_visibility");
  if (error && NOT_MIGRATED.has(error.code ?? "")) ({ data, error } = await read("id, username, avatar_color, avatar_initials"));
  if (error || !data) return null;
  const row = data as unknown as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.username !== "string") return null;
  return {
    id: row.id,
    username: row.username,
    avatarColor: typeof row.avatar_color === "string" ? row.avatar_color : "",
    avatarInitials: typeof row.avatar_initials === "string" ? row.avatar_initials : "",
    libraryVisibility: toVisibility(row.library_visibility),
  };
});

/** Escala de la persona que puntúa (su preferencia vive en `user_metadata`). */
export async function ownerShareScale(ownerId: string): Promise<ShareScale> {
  if (!ratingScale10Enabled()) return "legacy";
  const client = admin();
  if (!client) return "stars";
  try {
    const { data } = await client.auth.admin.getUserById(ownerId);
    return readRatingScale(data?.user ?? null);
  } catch {
    return "stars";
  }
}

export interface ShareMedia {
  title: string;
  poster: string | null;
  year?: number;
}

type RatingRow = {
  score: number | null;
  rating10?: number | string | null;
  media?: { title?: string | null; poster?: string | null; year?: number | null } | null;
};

/** La nota de `ownerId` sobre `mediaId` con el cliente indicado, o `null`. */
export async function loadOwnerRating(
  client: SupabaseClient,
  ownerId: string,
  mediaId: string
): Promise<{ score: number | null; rating10: number | null; media: ShareMedia | null } | null> {
  const read = (columns: string) =>
    client.from("user_media").select(columns).eq("user_id", ownerId).eq("media_id", mediaId).maybeSingle();
  let { data, error } = await read("score, rating10, media(title, poster, year)");
  if (error && NOT_MIGRATED.has(error.code ?? "")) ({ data, error } = await read("score, media(title, poster, year)"));
  if (error || !data) return null;
  const row = data as unknown as RatingRow;
  const raw10 = row.rating10 === null || row.rating10 === undefined ? null : Number(row.rating10);
  const rating10 = isValidRating10(raw10) ? raw10 : null;
  const score = typeof row.score === "number" ? row.score : null;
  if (rating10 === null && score === null) return null;
  const media = row.media?.title ? { title: row.media.title, poster: row.media.poster ?? null, year: row.media.year ?? undefined } : null;
  return { score, rating10, media };
}

/** Título público del catálogo: tabla `media` y, si no está, la ficha del proveedor (24 h). */
export const loadShareMedia = dedupe(async (type: MediaType, externalId: string, locale: string): Promise<ShareMedia | null> => {
  const client = admin();
  if (client) {
    const { data } = await client.from("media").select("title, poster, year").eq("id", `${type}_${externalId}`).maybeSingle();
    const row = data as { title?: string | null; poster?: string | null; year?: number | null } | null;
    if (row?.title) return { title: row.title, poster: row.poster ?? null, year: row.year ?? undefined };
  }
  const detail = await loadMediaDetail(type, externalId, locale);
  if (!detail) return null;
  return { title: detail.item.title, poster: detail.item.poster ?? null, year: detail.item.year };
});

// ── Decisión ──────────────────────────────────────────────────────────────────

/** Sin cuenta y sin firma: solo con la bandera y biblioteca "pública" (ver cabecera). */
export function anonymousCanSeeLibrary(visibility: LibraryVisibility | null): boolean {
  return process.env.SHARE_PUBLIC_LIBRARY === "1" && visibility === "public";
}

/** ¿Hay un bloqueo entre quien mira y el dueño? Sin la función: no. Otro error: sí (no se enseña). */
async function hasBlockWith(client: SupabaseClient, ownerId: string): Promise<boolean> {
  try {
    const { data, error } = await client.rpc("has_block_with", { p_other: ownerId });
    if (error) return !NOT_MIGRATED.has(error.code ?? "");
    return data === true;
  } catch {
    return true;
  }
}

export interface ShareViewer {
  id: string;
  supabase: SupabaseClient;
}

export type RatingShareView =
  | { kind: "not_found" }
  | {
      kind: "generic";
      owner: ShareOwner;
      parsed: ParsedMediaId;
      media: ShareMedia;
    }
  | {
      kind: "rated";
      owner: ShareOwner;
      parsed: ParsedMediaId;
      media: ShareMedia;
      rating: ShareRating;
      /** La vio gracias al enlace firmado (la tarjeta OG con nota es la firmada). */
      signed: boolean;
      /** Visible sin cuenta y sin firma (bandera): la tarjeta OG normal también la lleva. */
      publicWithoutSignature: boolean;
      isOwner: boolean;
    };

/**
 * Qué se enseña en `/u/{username}/r/{type}/{id}` a `viewer` (o sin sesión,
 * `null`, que es como se pide siempre la tarjeta OG), con la firma `sig`.
 */
export async function resolveRatingShare(input: {
  username: string;
  type: string;
  externalId: string;
  locale: string;
  sig?: unknown;
  viewer: ShareViewer | null;
}): Promise<RatingShareView> {
  const parsed = parseMediaId(`${input.type}_${input.externalId}`);
  if (!parsed) return { kind: "not_found" };
  const owner = await findShareOwner(input.username);
  if (!owner) return { kind: "not_found" };

  const { viewer } = input;
  const isOwner = viewer?.id === owner.id;
  const signed = isValidRatingShareSignature(owner.id, parsed.id, input.sig);
  const visibility = owner.libraryVisibility;
  const publicWithoutSignature = anonymousCanSeeLibrary(visibility);

  // Quién lee la fila: la sesión de quien mira cuando la RLS ya le deja; el
  // cliente admin solo cuando la deja ver el consentimiento (firma o bandera).
  let reader: SupabaseClient | null = null;
  if (isOwner) {
    reader = viewer!.supabase;
  } else if (!(viewer && (await hasBlockWith(viewer.supabase, owner.id))) && visibility !== "private") {
    if (viewer && (await viewerCanReadLibrary(viewer.supabase, owner.id))) reader = viewer.supabase;
    else if (signed || publicWithoutSignature) reader = admin();
  }

  const fromRow = reader ? await loadOwnerRating(reader, owner.id, parsed.id).catch(() => null) : null;
  const media = fromRow?.media ?? (await loadShareMedia(parsed.type, parsed.externalId, input.locale).catch(() => null));
  if (!media) return { kind: "not_found" };

  const rating = fromRow ? formatShareRating(fromRow, await ownerShareScale(owner.id), input.locale) : null;
  if (!rating) return { kind: "generic", owner, parsed, media };
  return { kind: "rated", owner, parsed, media, rating, signed, publicWithoutSignature, isOwner };
}

/**
 * Plantilla con `<rating>` y `<title>` ("{username} le da <rating>…</rating>
 * a <title>…</title>") → trozos para pintar cada parte con su estilo (la
 * página y la tarjeta OG, donde satori no tiene `t.rich`).
 */
export function splitRich(template: string, values: Record<string, string>): Array<{ text: string; tag?: string }> {
  // Primero las etiquetas de la PLANTILLA y luego los valores: un título con
  // "<b>" dentro se queda como texto, no abre una etiqueta.
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? "");
  const parts: Array<{ text: string; tag?: string }> = [];
  const re = /<(\w+)>([\s\S]*?)<\/\1>/g;
  let last = 0;
  for (let m = re.exec(template); m; m = re.exec(template)) {
    if (m.index > last) parts.push({ text: fill(template.slice(last, m.index)) });
    parts.push({ text: fill(m[2]), tag: m[1] });
    last = m.index + m[0].length;
  }
  if (last < template.length) parts.push({ text: fill(template.slice(last)) });
  return parts.filter((p) => p.text);
}

/** Igual que `splitRich` pero en texto plano (alt, títulos). */
export function plainRich(template: string, values: Record<string, string>): string {
  return splitRich(template, values)
    .map((p) => p.text)
    .join("");
}
