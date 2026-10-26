// ============================================================
// KULTURA — De filas de Wikidata a títulos de KULTURA (F-29, PRO-11)
//
// Cada obra relacionada trae los ids que tenga en Wikidata. KULTURA abre cada
// formato con UN proveedor, así que el id elegido decide el formato:
//   anime → AniList (`anime_al-N`) o MyAnimeList (`anime_N`, Jikan)
//   manga → AniList (`manga_al-N`) o MyAnimeList (`manga_N`)
//   movie → TMDB película        tv → TMDB serie
//   game  → RAWG (Wikidata da el slug; el número se resuelve aparte)
//   book  → Open Library (obra `OL…W`)
//   comic → Comic Vine (solo números `4000-N`; los volúmenes no se abren)
// El orden importa: una película de anime tiene id de TMDB y de AniList, y en
// KULTURA es anime; un manga con id de Open Library es manga.
//
// Sin dependencias de servidor: lo usan el cargador, los tests y el guion de
// verificación.
// ============================================================

import type { MediaType } from "@/types/media";
import { bindingValue, type SparqlBinding } from "@/lib/api/wikidata";

export type AdaptationRelation = "source" | "derivative" | "sibling" | "franchise";

const RELATIONS: readonly AdaptationRelation[] = ["source", "derivative", "sibling", "franchise"];

export interface AdaptationLink {
  /** `{type}_{externalId}` como en `media`; los juegos sin número aún: `null`. */
  mediaId: string | null;
  type: MediaType;
  /** Id del proveedor; en juegos sin resolver, vacío. */
  externalId: string;
  /** Slug de RAWG (solo juegos), para resolver el número. */
  rawgSlug?: string;
  /** Elemento de Wikidata (`Q…`). */
  qid: string;
  labels: { es?: string; en?: string };
  year?: number;
  /** De la más fuerte a la más débil (ver `RELATIONS`). */
  relations: AdaptationRelation[];
}

const DIGITS = /^\d{1,10}$/;
const RAWG_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Formato e id de KULTURA de una fila, por orden de preferencia. */
export function pickTarget(row: SparqlBinding): Pick<AdaptationLink, "type" | "externalId" | "rawgSlug"> | null {
  const v = (name: string) => bindingValue(row, name)?.trim();
  const alAnime = v("alAnime");
  if (alAnime && DIGITS.test(alAnime)) return { type: "anime", externalId: `al-${alAnime}` };
  const malAnime = v("malAnime");
  if (malAnime && DIGITS.test(malAnime)) return { type: "anime", externalId: malAnime };
  const alManga = v("alManga");
  if (alManga && DIGITS.test(alManga)) return { type: "manga", externalId: `al-${alManga}` };
  const malManga = v("malManga");
  if (malManga && DIGITS.test(malManga)) return { type: "manga", externalId: malManga };
  const movie = v("tmdbMovie");
  if (movie && DIGITS.test(movie)) return { type: "movie", externalId: movie };
  const tv = v("tmdbTv");
  if (tv && DIGITS.test(tv)) return { type: "tv", externalId: tv };
  const rawg = v("rawg")?.toLowerCase();
  if (rawg && RAWG_SLUG.test(rawg) && rawg.length <= 120) return { type: "game", externalId: "", rawgSlug: rawg };
  const ol = v("ol");
  if (ol && /^OL\d{1,12}W$/.test(ol)) return { type: "book", externalId: ol };
  const cv = /^4000-(\d{1,10})$/.exec(v("cv") ?? "");
  if (cv) return { type: "comic", externalId: cv[1] };
  return null;
}

function yearOf(raw: string | undefined): number | undefined {
  // xsd:dateTime "1965-01-01T00:00:00Z"; años negativos o absurdos fuera.
  const m = /^(\d{4})-/.exec(raw ?? "");
  const year = m ? Number(m[1]) : NaN;
  return Number.isFinite(year) && year >= 1000 && year <= 2100 ? year : undefined;
}

function relationsOf(raw: string | undefined): AdaptationRelation[] {
  const found = new Set((raw ?? "").split(",").map((s) => s.trim()));
  return RELATIONS.filter((r) => found.has(r));
}

function cleanLabel(raw: string | undefined): string | undefined {
  const s = raw?.replace(/\s+/g, " ").trim();
  // Una etiqueta que es el propio Q-id (sin traducir) no sirve de título.
  return s && !/^Q\d+$/.test(s) ? s.slice(0, 200) : undefined;
}

/** Una fila → vínculo, o `null` si no hay id que KULTURA sepa abrir o no tiene nombre. */
export function bindingToLink(row: SparqlBinding): AdaptationLink | null {
  const qid = bindingValue(row, "work");
  if (!qid || !/^Q\d+$/.test(qid)) return null;
  const target = pickTarget(row);
  if (!target) return null;
  const relations = relationsOf(bindingValue(row, "rels"));
  if (relations.length === 0) return null;
  // "mul" (etiqueta común a todos los idiomas) hace de inglés si no lo hay.
  const mul = cleanLabel(bindingValue(row, "labelMul"));
  const labels = { es: cleanLabel(bindingValue(row, "labelEs")), en: cleanLabel(bindingValue(row, "labelEn")) ?? mul };
  if (!labels.es && !labels.en) return null;
  return {
    mediaId: target.externalId ? `${target.type}_${target.externalId}` : null,
    type: target.type,
    externalId: target.externalId,
    ...(target.rawgSlug ? { rawgSlug: target.rawgSlug } : {}),
    qid,
    labels: Object.fromEntries(Object.entries(labels).filter(([, l]) => l)) as AdaptationLink["labels"],
    year: yearOf(bindingValue(row, "date")),
    relations,
  };
}

const rank = (link: AdaptationLink) => RELATIONS.indexOf(link.relations[0]);

/**
 * Vínculos limpios: sin el propio título, sin repetidos (mismo id de KULTURA
 * o mismo elemento de Wikidata) y ordenados de lo más directo a lo más lejano
 * (de qué está basado → sus adaptaciones → hermanas → franquicia) y, dentro,
 * por año.
 */
export function mapAdaptations(bindings: SparqlBinding[], subjectMediaId: string): AdaptationLink[] {
  const byKey = new Map<string, AdaptationLink>();
  for (const row of bindings) {
    const link = bindingToLink(row);
    if (!link || link.mediaId === subjectMediaId) continue;
    const key = link.mediaId ?? `game-slug:${link.rawgSlug}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, link);
      continue;
    }
    // Dos elementos de Wikidata con el mismo id (obra y su edición): se queda
    // la relación más fuerte y se suman etiquetas que faltaran.
    const relations = RELATIONS.filter((r) => prev.relations.includes(r) || link.relations.includes(r));
    byKey.set(key, {
      ...prev,
      relations,
      labels: { ...link.labels, ...prev.labels },
      year: prev.year ?? link.year,
    });
  }
  return [...byKey.values()].sort(
    (a, b) => rank(a) - rank(b) || (a.year ?? 9999) - (b.year ?? 9999) || a.qid.localeCompare(b.qid)
  );
}

/** El elemento de Wikidata del propio título (todas las filas lo traen). */
export function subjectQid(bindings: SparqlBinding[]): string | null {
  for (const row of bindings) {
    const q = bindingValue(row, "subject");
    if (q && /^Q\d+$/.test(q)) return q;
  }
  return null;
}

/** Título en el idioma de la página, con el otro de respaldo. */
export function linkTitle(link: Pick<AdaptationLink, "labels">, locale: string): string {
  const { es, en } = link.labels;
  return (locale === "en" ? (en ?? es) : (es ?? en)) ?? "";
}

/** ¿Tiene forma de vínculo guardado? (lo que se lee de la tabla es JSON). */
export function isAdaptationLink(value: unknown): value is AdaptationLink {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    (v.mediaId === null || typeof v.mediaId === "string") &&
    typeof v.type === "string" &&
    typeof v.externalId === "string" &&
    typeof v.qid === "string" &&
    !!v.labels &&
    typeof v.labels === "object" &&
    Array.isArray(v.relations)
  );
}
