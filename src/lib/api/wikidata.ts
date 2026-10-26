// ============================================================
// KULTURA — Wikidata: "basado en" (P144), adaptaciones y franquicia (F-29)
//
// Una sola consulta SPARQL por título. Se localiza la entidad por el id
// externo que KULTURA ya tiene (TMDB, AniList, MyAnimeList, Open Library,
// RAWG, Comic Vine) y se piden, con sus ids externos, las obras:
//   - source:     en las que se basa (P144 del título o de su serie); si el
//                 origen es una saga, también sus libros o tomos (`part`);
//   - adaptation: que se basan en él (P144 inverso) o que declara como obra
//                 derivada (P4969);
//   - sibling:    otras adaptaciones de su misma obra de origen (la película
//                 de 1984 desde la de 2021: las dos se basan en la novela);
//   - franchise:  las de su misma franquicia (P8345) o serie (P179).
// Cada obra vuelve a KULTURA por sus ids externos (`kulturaIdFor`); la que no
// tiene ninguno que KULTURA sepa abrir (un personaje, un álbum…) ni se pide.
// Las de la franquicia van al final: si el tope de filas corta, corta ahí.
//
// Módulo puro salvo `fetchAdaptations` (la red, inyectable en los tests). Sin
// imports de `@/` en tiempo de ejecución: el script que graba las respuestas
// de los tests lo carga con Node tal cual.
// ============================================================

import type { MediaType } from "@/types/media";

export const WIKIDATA_SPARQL_URL = "https://query.wikidata.org/sparql";
/** Wikidata pide un User-Agent con contacto a los bots (política de WDQS). */
export const WIKIDATA_USER_AGENT = "KulturaBot/1.0 (https://github.com/benevi/kultura)";
const DEFAULT_TIMEOUT_MS = 4000;

export type AdaptationRelation = "source" | "adaptation" | "sibling" | "franchise";

/** Propiedades de Wikidata con ids externos que KULTURA sabe abrir. */
export const WD_PROPS = {
  tmdbMovie: "P4947",
  tmdbTv: "P4983",
  anilistAnime: "P8729",
  malAnime: "P4086",
  anilistManga: "P8731",
  malManga: "P4087",
  openLibrary: "P648",
  comicVine: "P5905",
  rawg: "P9968",
} as const;

const ID_PROPS = Object.values(WD_PROPS);

/** Cómo encontrar el título en Wikidata: propiedad + valor exacto. */
export interface WikidataKey {
  prop: string;
  value: string;
}

/**
 * Propiedad y valor de Wikidata para un id de KULTURA. `null` si su forma no
 * tiene equivalente (manga de MangaDex, libro de Google Books…). El juego
 * necesita el slug de RAWG (`rawgSlug`), que llega con la ficha.
 */
export function wikidataKeyFor(mediaId: string, hints: { rawgSlug?: string } = {}): WikidataKey | null {
  const sep = mediaId.indexOf("_");
  if (sep <= 0) return null;
  const type = mediaId.slice(0, sep);
  const ext = mediaId.slice(sep + 1);
  const num = /^\d{1,10}$/;
  const prefixed = (prefix: string) =>
    ext.startsWith(prefix) && num.test(ext.slice(prefix.length)) ? ext.slice(prefix.length) : null;

  switch (type) {
    case "movie":
      return num.test(ext) ? { prop: WD_PROPS.tmdbMovie, value: ext } : null;
    case "tv":
      return num.test(ext) ? { prop: WD_PROPS.tmdbTv, value: ext } : null;
    case "anime": {
      const al = prefixed("al-");
      if (al) return { prop: WD_PROPS.anilistAnime, value: al };
      const tmdb = prefixed("tmdb-");
      if (tmdb) return { prop: WD_PROPS.tmdbTv, value: tmdb };
      return num.test(ext) ? { prop: WD_PROPS.malAnime, value: ext } : null;
    }
    case "manga": {
      const al = prefixed("al-");
      if (al) return { prop: WD_PROPS.anilistManga, value: al };
      return num.test(ext) ? { prop: WD_PROPS.malManga, value: ext } : null;
    }
    case "book":
      return /^OL\d{1,12}W$/.test(ext) ? { prop: WD_PROPS.openLibrary, value: ext } : null;
    case "comic":
      return num.test(ext) ? { prop: WD_PROPS.comicVine, value: `4000-${ext}` } : null;
    case "game": {
      const slug = hints.rawgSlug?.toLowerCase();
      return slug && /^[a-z0-9][a-z0-9-]{0,120}$/.test(slug) ? { prop: WD_PROPS.rawg, value: slug } : null;
    }
    default:
      return null;
  }
}

/** Literal SPARQL seguro (los valores ya vienen validados; se escapa igual). */
function literal(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** La consulta: una fila por (obra relacionada, relación), con sus ids y etiquetas es/en. */
export function buildAdaptationsQuery(key: WikidataKey): string {
  if (!/^P\d{1,6}$/.test(key.prop)) throw new Error(`Propiedad de Wikidata no válida: ${key.prop}`);
  const props = ID_PROPS.map((p) => `wdt:${p}`).join(" ");
  return `SELECT ?item ?other ?rel (SAMPLE(?esL) AS ?es) (SAMPLE(?enL) AS ?en) (SAMPLE(?mulL) AS ?mul) (MIN(?d) AS ?date)
  (GROUP_CONCAT(DISTINCT CONCAT(STRAFTER(STR(?p), "direct/"), "=", STR(?v)); separator="|") AS ?ids) WHERE {
  ?item wdt:${key.prop} ${literal(key.value)} .
  {
    { ?item wdt:P144 ?other . BIND("source" AS ?rel) }
    UNION { ?item wdt:P179 ?ser . ?ser wdt:P144 ?other . BIND("source" AS ?rel) }
    UNION { ?item wdt:P144 ?src . ?other wdt:P179 ?src . BIND("sourcePart" AS ?rel) }
    UNION { ?other wdt:P144 ?item . BIND("adaptation" AS ?rel) }
    UNION { ?item wdt:P4969 ?other . BIND("adaptation" AS ?rel) }
    UNION { ?item wdt:P144 ?src . ?other wdt:P144 ?src . FILTER(?other != ?item) BIND("sibling" AS ?rel) }
    UNION { ?item wdt:P144 ?src . ?src wdt:P4969 ?other . FILTER(?other != ?item) BIND("sibling" AS ?rel) }
    UNION { ?item wdt:P8345 ?other . BIND("franchiseRoot" AS ?rel) }
    UNION { ?item wdt:P8345 ?fr . ?other wdt:P8345 ?fr . FILTER(?other != ?item) BIND("franchise" AS ?rel) }
    UNION { ?item wdt:P179 ?other . BIND("seriesRoot" AS ?rel) }
    UNION { ?item wdt:P179 ?ser . ?other wdt:P179 ?ser . FILTER(?other != ?item) BIND("franchise" AS ?rel) }
  }
  OPTIONAL { VALUES ?p { ${props} } ?other ?p ?v . }
  FILTER(?rel IN ("franchiseRoot", "seriesRoot") || BOUND(?v))
  OPTIONAL { ?other rdfs:label ?esL . FILTER(LANG(?esL) = "es") }
  OPTIONAL { ?other rdfs:label ?enL . FILTER(LANG(?enL) = "en") }
  OPTIONAL { ?other rdfs:label ?mulL . FILTER(LANG(?mulL) = "mul") }
  OPTIONAL { ?other wdt:P577 ?d . }
}
GROUP BY ?item ?other ?rel
ORDER BY (IF(?rel = "franchise", 1, 0))
LIMIT 400`;
}

/** Obra relacionada tal y como la da Wikidata (sin resolver a KULTURA). */
export interface WikidataWork {
  qid: string;
  rel: AdaptationRelation;
  es?: string;
  en?: string;
  year?: number;
  /** Origen indirecto: un libro o tomo de la saga en la que se basa (no la saga). */
  part?: true;
  /** Ids externos por propiedad (`P4947` → `["438631"]`). */
  ids: Record<string, string[]>;
}

export interface WikidataAdaptations {
  /** Entidad del propio título (`Q…`), `null` si Wikidata no lo tiene. */
  qid: string | null;
  works: WikidataWork[];
  /** Franquicia (P8345) o, si no hay, serie (P179). */
  franchise: { qid: string; es?: string; en?: string } | null;
}

interface Binding {
  [k: string]: { value: string } | undefined;
}

const qidOf = (uri: string | undefined) => (uri ? (/\/(Q\d+)$/.exec(uri)?.[1] ?? null) : null);

function parseIds(raw: string | undefined): Record<string, string[]> {
  const ids: Record<string, string[]> = {};
  for (const pair of (raw ?? "").split("|")) {
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const prop = pair.slice(0, eq);
    const value = pair.slice(eq + 1).trim();
    if (!value) continue;
    (ids[prop] ??= []).push(value);
  }
  for (const prop of Object.keys(ids)) ids[prop].sort();
  return ids;
}

function parseYear(raw: string | undefined): number | undefined {
  const m = /^(-?\d{1,4})-/.exec(raw ?? "");
  const y = m ? Number(m[1]) : NaN;
  return Number.isFinite(y) && y > 0 ? y : undefined;
}

/** Respuesta JSON de WDQS → obras y franquicia. Tolerante a respuestas raras (nunca lanza). */
export function parseAdaptationsResponse(json: unknown): WikidataAdaptations {
  const bindings = (json as { results?: { bindings?: Binding[] } } | null)?.results?.bindings;
  const out: WikidataAdaptations = { qid: null, works: [], franchise: null };
  if (!Array.isArray(bindings)) return out;
  let series: WikidataAdaptations["franchise"] = null;
  for (const b of bindings) {
    out.qid ??= qidOf(b.item?.value);
    const qid = qidOf(b.other?.value);
    const rel = b.rel?.value;
    if (!qid || !rel) continue;
    // `mul` (etiqueta "para todos los idiomas", 2024): muchas obras ya no
    // tienen `en` propia y solo traen esa.
    const mul = b.mul?.value || undefined;
    const es = b.es?.value || mul;
    const en = b.en?.value || mul;
    if (rel === "franchiseRoot") {
      out.franchise ??= { qid, es, en };
      continue;
    }
    if (rel === "seriesRoot") {
      series ??= { qid, es, en };
      continue;
    }
    if (rel === "sourcePart") {
      out.works.push({ qid, rel: "source", part: true, es, en, year: parseYear(b.date?.value), ids: parseIds(b.ids?.value) });
      continue;
    }
    if (rel !== "source" && rel !== "adaptation" && rel !== "sibling" && rel !== "franchise") continue;
    out.works.push({ qid, rel, es, en, year: parseYear(b.date?.value), ids: parseIds(b.ids?.value) });
  }
  out.franchise ??= series;
  return out;
}

/** Título de KULTURA al que lleva una obra de Wikidata. */
export interface KulturaRef {
  type: MediaType;
  /**
   * `null` cuando falta un paso: el juego (Wikidata da el slug de RAWG, no el
   * id numérico) y el libro del que solo consta una edición de Open Library
   * (`OL…M`; la ficha abre obras, `OL…W`). Lo resuelve `src/lib/adaptations`.
   */
  mediaId: string | null;
  rawgSlug?: string;
  olEdition?: string;
}

const first = (ids: Record<string, string[]>, prop: string, re: RegExp) =>
  (ids[prop] ?? []).find((v) => re.test(v)) ?? null;

/**
 * Ids externos → título de KULTURA. Si una obra tiene varios (una película de
 * anime está en TMDB y en AniList), manda el formato más específico: anime >
 * serie > película > manga > cómic > libro > juego.
 */
export function kulturaIdFor(ids: Record<string, string[]>): KulturaRef | null {
  const n = /^\d{1,10}$/;
  const al = first(ids, WD_PROPS.anilistAnime, n);
  if (al) return { type: "anime", mediaId: `anime_al-${al}` };
  const malA = first(ids, WD_PROPS.malAnime, n);
  if (malA) return { type: "anime", mediaId: `anime_${malA}` };
  const tv = first(ids, WD_PROPS.tmdbTv, n);
  if (tv) return { type: "tv", mediaId: `tv_${tv}` };
  const movie = first(ids, WD_PROPS.tmdbMovie, n);
  if (movie) return { type: "movie", mediaId: `movie_${movie}` };
  const alM = first(ids, WD_PROPS.anilistManga, n);
  if (alM) return { type: "manga", mediaId: `manga_al-${alM}` };
  const malM = first(ids, WD_PROPS.malManga, n);
  if (malM) return { type: "manga", mediaId: `manga_${malM}` };
  const issue = first(ids, WD_PROPS.comicVine, /^4000-\d{1,10}$/);
  if (issue) return { type: "comic", mediaId: `comic_${issue.slice(5)}` };
  const ol = first(ids, WD_PROPS.openLibrary, /^OL\d{1,12}W$/);
  if (ol) return { type: "book", mediaId: `book_${ol}` };
  const edition = first(ids, WD_PROPS.openLibrary, /^OL\d{1,12}M$/);
  if (edition) return { type: "book", mediaId: null, olEdition: edition };
  const slug = first(ids, WD_PROPS.rawg, /^[a-z0-9][a-z0-9-]{0,120}$/);
  if (slug) return { type: "game", mediaId: null, rawgSlug: slug };
  return null;
}

export class WikidataError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "WikidataError";
    this.status = status;
  }
}

/**
 * Pide las adaptaciones de un título a WDQS. Lanza `WikidataError` si la red
 * falla, tarda más de `timeoutMs` o responde con error: quien llama decide
 * (la ficha se pinta sin la sección; la caché guarda la última buena).
 */
export async function fetchAdaptations(
  key: WikidataKey,
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<WikidataAdaptations> {
  const url = `${WIKIDATA_SPARQL_URL}?query=${encodeURIComponent(buildAdaptationsQuery(key))}&format=json`;
  const doFetch = opts.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await doFetch(url, {
      headers: { Accept: "application/sparql-results+json", "User-Agent": WIKIDATA_USER_AGENT },
      signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    throw new WikidataError(`Wikidata no responde: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok) throw new WikidataError(`Wikidata → ${res.status}`, res.status);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new WikidataError("Wikidata devolvió algo que no es JSON");
  }
  return parseAdaptationsResponse(json);
}
