// ============================================================
// KULTURA — "También existe como…" y franquicia: modelo (F-29). PURO.
//
// Wikidata (src/lib/api/wikidata.ts) → lo que se guarda en la caché
// (`StoredAdaptations`, independiente del idioma: lleva las etiquetas es/en)
// → lo que pinta la ficha (`AdaptationsView`, ya en el idioma de la página).
// ============================================================

import type { MediaType } from "@/types/media";
import {
  kulturaIdFor,
  type AdaptationRelation,
  type WikidataAdaptations,
} from "@/lib/api/wikidata";
import { parseMediaId } from "@/lib/media/media-id";

/** Versión del formato guardado: si cambia, lo viejo se ignora y se vuelve a pedir. */
export const STORED_VERSION = 1;

export interface StoredWork {
  mediaId: string;
  type: MediaType;
  rel: AdaptationRelation;
  qid: string;
  es?: string;
  en?: string;
  year?: number;
  /** Tomo o libro de la saga de origen (no la saga): va detrás y no cuenta como franquicia. */
  part?: true;
}

export interface StoredAdaptations {
  v: typeof STORED_VERSION;
  qid: string | null;
  works: StoredWork[];
  franchise: { qid: string; es?: string; en?: string } | null;
}

/** Lo que falta por resolver para llegar a un id de KULTURA (ver `KulturaRef`). */
export interface PendingRef {
  /** Clave estable: `rawg:{slug}` u `ol:{OL…M}`. */
  key: string;
  kind: "rawg" | "olEdition";
  value: string;
}

export function pendingKey(kind: PendingRef["kind"], value: string): string {
  return `${kind === "rawg" ? "rawg" : "ol"}:${value}`;
}

/** Obras que necesitan un paso más (slug de RAWG, edición de Open Library), sin repetir. */
export function pendingRefs(parsed: WikidataAdaptations): PendingRef[] {
  const out = new Map<string, PendingRef>();
  for (const w of parsed.works) {
    const ref = kulturaIdFor(w.ids);
    if (!ref || ref.mediaId) continue;
    if (ref.rawgSlug) out.set(pendingKey("rawg", ref.rawgSlug), { key: pendingKey("rawg", ref.rawgSlug), kind: "rawg", value: ref.rawgSlug });
    if (ref.olEdition) out.set(pendingKey("olEdition", ref.olEdition), { key: pendingKey("olEdition", ref.olEdition), kind: "olEdition", value: ref.olEdition });
  }
  return Array.from(out.values());
}

const REL_RANK: Record<AdaptationRelation, number> = { source: 0, adaptation: 1, sibling: 2, franchise: 3 };

/**
 * Respuesta de Wikidata + lo resuelto aparte (`resolved`: clave pendiente →
 * id de KULTURA) → formato de la caché. Una fila por título de KULTURA (si
 * dos entidades llevan al mismo, gana la relación más fuerte), nunca el
 * propio título y nunca un id con forma que la ficha no sepa abrir.
 */
export function toStored(
  parsed: WikidataAdaptations,
  selfMediaId: string,
  resolved: ReadonlyMap<string, string> = new Map(),
): StoredAdaptations {
  const byId = new Map<string, StoredWork>();
  for (const w of parsed.works) {
    const ref = kulturaIdFor(w.ids);
    if (!ref) continue;
    const mediaId =
      ref.mediaId ??
      (ref.rawgSlug ? resolved.get(pendingKey("rawg", ref.rawgSlug)) : undefined) ??
      (ref.olEdition ? resolved.get(pendingKey("olEdition", ref.olEdition)) : undefined);
    if (!mediaId || mediaId === selfMediaId || !parseMediaId(mediaId)) continue;
    const prev = byId.get(mediaId);
    const rank = (x: { rel: AdaptationRelation; part?: true }) => REL_RANK[x.rel] + (x.part ? 0.5 : 0);
    if (prev && rank(prev) <= rank(w)) {
      // Misma obra por otra vía: se completa lo que faltara, sin cambiar la relación.
      prev.es ??= w.es;
      prev.en ??= w.en;
      prev.year ??= w.year;
      continue;
    }
    // Relación más fuerte: se queda con ella, y con las etiquetas de la otra vía
    // si a esta le faltan.
    const es = w.es ?? prev?.es;
    const en = w.en ?? prev?.en;
    const year = w.year ?? prev?.year;
    byId.set(mediaId, {
      mediaId,
      type: ref.type,
      rel: w.rel,
      qid: w.qid,
      ...(es ? { es } : {}),
      ...(en ? { en } : {}),
      ...(year ? { year } : {}),
      ...(w.part ? { part: true as const } : {}),
    });
  }
  return { v: STORED_VERSION, qid: parsed.qid, works: Array.from(byId.values()), franchise: parsed.franchise };
}

/** ¿Es un `payload` de la caché con el formato actual? (lo viejo o roto se vuelve a pedir) */
export function isStoredAdaptations(value: unknown): value is StoredAdaptations {
  const v = value as StoredAdaptations | null;
  return Boolean(v) && v!.v === STORED_VERSION && Array.isArray(v!.works);
}

// ── Vista ─────────────────────────────────────────────────────────────────────

export interface AdaptationLink {
  mediaId: string;
  type: MediaType;
  externalId: string;
  title: string;
  year?: number;
  rel: AdaptationRelation;
  part?: true;
  poster?: string | null;
}

export interface AdaptationsView {
  /** Origen, adaptaciones y "hermanas" (otras adaptaciones de la misma obra). */
  alsoAs: AdaptationLink[];
  /** Solo si Wikidata da franquicia o serie y hay al menos 2 títulos más. */
  franchise: { name: string; members: AdaptationLink[] } | null;
}

export const MAX_ALSO_AS = 12;
/** De una serie de libros larga (Mundodisco…) no se enseñan los 40 como "origen". */
const MAX_SOURCES = 4;
/** Con origen directo (el manga), sus tomos sobran casi siempre: como mucho dos. */
const MAX_PARTS_WITH_DIRECT = 2;
export const MAX_FRANCHISE = 40;
const MIN_FRANCHISE = 2;

const label = (x: { es?: string; en?: string }, locale: string) =>
  (locale === "es" ? (x.es ?? x.en) : (x.en ?? x.es))?.trim() || null;

const byYear = (a: AdaptationLink, b: AdaptationLink) =>
  (a.year ?? 9999) - (b.year ?? 9999) || a.title.localeCompare(b.title);

/** Formato guardado → lo que pinta la ficha, en el idioma de la página. */
export function buildView(stored: StoredAdaptations | null, selfMediaId: string, locale: string): AdaptationsView {
  const empty: AdaptationsView = { alsoAs: [], franchise: null };
  if (!stored) return empty;
  const links: AdaptationLink[] = [];
  for (const w of stored.works) {
    const parsed = parseMediaId(w.mediaId);
    const title = label(w, locale);
    if (!parsed || !title || w.mediaId === selfMediaId) continue;
    links.push({
      mediaId: w.mediaId,
      type: parsed.type,
      externalId: parsed.externalId,
      title,
      year: w.year,
      rel: w.rel,
      ...(w.part ? { part: true as const } : {}),
    });
  }
  // Origen directo primero (la novela, el manga); sus tomos o libros, detrás.
  const direct = links.filter((l) => l.rel === "source" && !l.part).sort(byYear);
  const parts = links
    .filter((l) => l.rel === "source" && l.part)
    .sort(byYear)
    .slice(0, direct.length > 0 ? MAX_PARTS_WITH_DIRECT : MAX_SOURCES);
  const sources = [...direct, ...parts].slice(0, MAX_SOURCES);
  const others = links.filter((l) => l.rel === "adaptation" || l.rel === "sibling").sort(byYear);
  const alsoAs = [...sources, ...others].slice(0, MAX_ALSO_AS);

  const franchiseName = stored.franchise ? label(stored.franchise, locale) : null;
  // Los tomos sueltos de la saga de origen no son "la franquicia" (27 tomos de
  // un manga inundarían "Añadir toda la franquicia").
  const members = links.filter((l) => !l.part).sort(byYear).slice(0, MAX_FRANCHISE);
  const franchise =
    franchiseName && members.length >= MIN_FRANCHISE ? { name: franchiseName, members } : null;
  return { alsoAs, franchise };
}

/** Slug de RAWG a partir del enlace a la fuente (`rawg.io/games/{slug}`); un id numérico no vale. */
export function rawgSlugFromUrl(url: string | undefined): string | undefined {
  const slug = url ? /^https:\/\/rawg\.io\/games\/([a-z0-9-]+)$/.exec(url)?.[1] : undefined;
  return slug && !/^\d+$/.test(slug) ? slug : undefined;
}
