// ============================================================
// KULTURA — Cliente de Wikidata (SPARQL) para las adaptaciones (F-29, PRO-11)
//
// Wikidata enlaza obras con "basado en" (P144) y su inversa "obra derivada"
// (P4969), y casi todas las obras conocidas llevan el id que usa KULTURA en
// cada proveedor. Con UNA consulta se obtiene, para el título de la ficha:
//   - lo que adapta (P144 directo, P4969 inverso) y, si eso es una
//     saga, sus libros (P179 de la saga: "The Witcher" → "El último deseo") → "source"
//   - lo que lo adapta a él (P144 inverso, P4969 directo)        → "derivative"
//   - otras adaptaciones de la misma obra de origen              → "sibling"
//   - el resto de su franquicia (P8345 "media franchise")        → "franchise"
// y de cada obra relacionada sus ids externos, fecha y etiqueta es/en.
//
// Propiedades comprobadas en Wikidata (Special:EntityData, 2026-10-26):
//   P144  based on                    P4969 derivative work
//   P8345 media franchise             P577  publication date
//   P179  part of the series (temporada → serie)
//   P4947 TMDB movie ID               P4983 TMDB TV series ID
//   P8729 AniList anime ID            P8731 AniList manga ID
//   P4086 MyAnimeList anime ID        P4087 MyAnimeList manga ID
//   P648  Open Library ID (W/M/A)     P675  Google Books ID
//   P9968 RAWG game ID (es el SLUG: "the-witcher-3-wild-hunt", no el número)
//   P5905 Comic Vine ID ("4000-…" número, "4050-…" volumen)
// MangaDex no tiene propiedad en Wikidata: un manga de MangaDex se busca por
// los ids de AniList / MyAnimeList que MangaDex publica en `attributes.links`.
//
// Uso del servicio (https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual):
// User-Agent identificativo con URL y contacto (`providerUserAgent`, D-18),
// plazo propio (7 s) y circuito de `providerFetch`. Las respuestas se guardan en la
// tabla `media_adaptations` (o, sin ella, en la caché de datos de Next): una
// ficha consulta Wikidata como mucho una vez cada varios días.
//
// Etiquetas: es, en y "mul" (desde 2024 Wikidata deja en "mul" la etiqueta
// común a todos los idiomas y quita la inglesa repetida: "The Last of Us" ya
// no tiene etiqueta "en").
//
// Trampa conocida de Blazegraph (WDQS): reutilizar el nombre de una variable
// como alias de su agregado (`(MIN(?date) AS ?date)`) no da un 400 sino un
// 500 con StackOverflowError. Los alias llevan sufijo `_`.
// ============================================================

import { z } from "zod";
import { providerFetch, type ProviderId } from "@/lib/api/http";
import type { MediaType } from "@/types/media";

export const WIKIDATA_SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";

/** Proveedor para el circuito y los logs de `providerFetch`. */
export const WIKIDATA_PROVIDER: ProviderId = "wikidata";

/** Plazo por intento: WDQS tarda 0,3-3 s con franquicias grandes (Dune ~3 s). */
export const WIKIDATA_TIMEOUT_MS = 7000;

/** Propiedades de Wikidata usadas (ver cabecera). */
export const WD = {
  basedOn: "P144",
  derivativeWork: "P4969",
  mediaFranchise: "P8345",
  partOfSeries: "P179",
  publicationDate: "P577",
  tmdbMovie: "P4947",
  tmdbTv: "P4983",
  anilistAnime: "P8729",
  anilistManga: "P8731",
  malAnime: "P4086",
  malManga: "P4087",
  openLibrary: "P648",
  googleBooks: "P675",
  rawgGame: "P9968",
  comicVine: "P5905",
} as const;

/** Cómo se encuentra el título de la ficha en Wikidata: propiedad + valor. */
export interface WikidataClaim {
  property: (typeof WD)[keyof typeof WD];
  value: string;
}

/** Datos extra que algunos proveedores necesitan para dar con el id de Wikidata. */
export interface ClaimHints {
  /** Slug de RAWG del juego (Wikidata guarda el slug, KULTURA el número). */
  rawgSlug?: string;
  /** `attributes.links` de MangaDex (`al`, `mal`…). */
  mangaDexLinks?: Record<string, unknown>;
  /** Id de MyAnimeList que da AniList (`idMal`): segunda vía si falta el de AniList. */
  malId?: unknown;
}

const DIGITS = /^\d{1,10}$/;
const RAWG_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const OL_ID = /^OL\d{1,12}[WM]$/;
const GOOGLE_ID = /^[A-Za-z0-9_-]{6,24}$/;

function digits(value: unknown): string | null {
  const s = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  return DIGITS.test(s) ? s : null;
}

/**
 * Propiedad y valor con los que Wikidata identifica el título de KULTURA, o
 * `null` si no hay forma (cómic sin id, MangaDex sin enlaces…). Solo valores
 * con forma validada: el valor va dentro de la consulta SPARQL.
 */
export function subjectClaim(type: MediaType, externalId: string, hints: ClaimHints = {}): WikidataClaim | null {
  switch (type) {
    case "movie":
      return DIGITS.test(externalId) ? { property: WD.tmdbMovie, value: externalId } : null;
    case "tv":
      return DIGITS.test(externalId) ? { property: WD.tmdbTv, value: externalId } : null;
    case "anime": {
      const al = /^al-(\d{1,10})$/.exec(externalId);
      if (al) return { property: WD.anilistAnime, value: al[1] };
      const tmdb = /^tmdb-(\d{1,10})$/.exec(externalId);
      if (tmdb) return { property: WD.tmdbTv, value: tmdb[1] };
      return DIGITS.test(externalId) ? { property: WD.malAnime, value: externalId } : null;
    }
    case "manga": {
      const al = /^al-(\d{1,10})$/.exec(externalId);
      if (al) return { property: WD.anilistManga, value: al[1] };
      if (DIGITS.test(externalId)) return { property: WD.malManga, value: externalId };
      const links = hints.mangaDexLinks ?? {};
      const alLink = digits(links.al);
      if (alLink) return { property: WD.anilistManga, value: alLink };
      const malLink = digits(links.mal);
      return malLink ? { property: WD.malManga, value: malLink } : null;
    }
    case "book": {
      // Wikidata guarda la OBRA (`…W`) en las novelas; una edición (`…M`)
      // casi nunca está, pero si está también vale.
      if (OL_ID.test(externalId)) return { property: WD.openLibrary, value: externalId };
      return GOOGLE_ID.test(externalId) ? { property: WD.googleBooks, value: externalId } : null;
    }
    case "game": {
      const slug = hints.rawgSlug?.trim().toLowerCase();
      return slug && RAWG_SLUG.test(slug) && slug.length <= 120 ? { property: WD.rawgGame, value: slug } : null;
    }
    case "comic":
      return DIGITS.test(externalId) ? { property: WD.comicVine, value: `4000-${externalId}` } : null;
    default:
      return null;
  }
}

/**
 * Todas las vías para encontrar el título: la principal (`subjectClaim`) y,
 * si la hay, la de MyAnimeList (Wikidata tiene muchos animes con id de MAL y
 * sin el de AniList, o al revés).
 */
export function subjectClaims(type: MediaType, externalId: string, hints: ClaimHints = {}): WikidataClaim[] {
  const main = subjectClaim(type, externalId, hints);
  const claims = main ? [main] : [];
  const mal = digits(hints.malId);
  if (mal && (type === "anime" || type === "manga")) {
    const property = type === "anime" ? WD.malAnime : WD.malManga;
    if (!claims.some((c) => c.property === property && c.value === mal)) claims.push({ property, value: mal });
  }
  return claims;
}

/** Literal SPARQL entre comillas (los valores ya vienen validados; esto es la red). */
function sparqlString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]/g, " ")}"`;
}

/** Como mucho estas obras relacionadas por consulta (las franquicias grandes tienen cientos). */
export const WIKIDATA_ROW_LIMIT = 80;
/** Relaciones candidatas antes de filtrar por ids (Star Wars, Marvel…). */
const CANDIDATE_LIMIT = 400;

/**
 * Consulta de adaptaciones de un título. Solo devuelve obras con algún id que
 * KULTURA sepa abrir (TMDB, AniList, MAL, Open Library, RAWG, Comic Vine).
 *
 * El elemento con el id (`?seed`) a veces es una TEMPORADA ("Attack on Titan,
 * season 1" lleva el id de AniList; el "basado en" está en la serie): el sujeto
 * es el propio elemento o la serie de la que forma parte (P179, cero o un
 * salto). Con varias vías (`subjectClaims`) se prueban todas a la vez.
 */
export function buildAdaptationsQuery(claim: WikidataClaim | WikidataClaim[]): string {
  const claims = (Array.isArray(claim) ? claim : [claim]).slice(0, 3);
  if (claims.length === 0) throw new Error("buildAdaptationsQuery: sin vía para encontrar el título");
  // Cada vía, dos ramas: el propio elemento y su serie. El BIND va en la MISMA
  // rama que el patrón que fija ?seed (en una rama aparte ?seed no está
  // ligado y ?subject casaría con todo Wikidata), y nada de `wdt:P179?`
  // (camino de cero o un salto): Blazegraph lo evalúa desde el otro extremo y
  // la consulta acaba en 504.
  const subject = claims
    .map((c) => {
      const seed = `?seed wdt:${c.property} ${sparqlString(c.value)} .`;
      return `{ ${seed} BIND(?seed AS ?subject) } UNION { ${seed} ?seed wdt:${WD.partOfSeries} ?subject . }`;
    })
    .join("\n      UNION ");
  return `SELECT ?work (MIN(?seed) AS ?subject_) (GROUP_CONCAT(DISTINCT ?rel; separator=",") AS ?rels_)
  (MIN(?tmdbMovie) AS ?tmdbMovie_) (MIN(?tmdbTv) AS ?tmdbTv_)
  (MIN(?alAnime) AS ?alAnime_) (MIN(?alManga) AS ?alManga_)
  (MIN(?malAnime) AS ?malAnime_) (MIN(?malManga) AS ?malManga_)
  (MIN(?ol) AS ?ol_) (MIN(?rawg) AS ?rawg_) (MIN(?cv) AS ?cv_)
  (MIN(?prio) AS ?prio_) (MIN(?date) AS ?date_) (MIN(?labelEs) AS ?labelEs_) (MIN(?labelEn) AS ?labelEn_) (MIN(?labelMul) AS ?labelMul_)
WHERE {
  {
    SELECT DISTINCT ?seed ?work ?rel ?prio WHERE {
      {
      ${subject}
      }
      {
        { ?subject wdt:${WD.basedOn} ?work . BIND("source" AS ?rel) BIND(0 AS ?prio) }
        UNION { ?work wdt:${WD.basedOn} ?subject . BIND("derivative" AS ?rel) BIND(1 AS ?prio) }
        UNION { ?subject wdt:${WD.derivativeWork} ?work . BIND("derivative" AS ?rel) BIND(1 AS ?prio) }
        UNION { ?work wdt:${WD.derivativeWork} ?subject . BIND("source" AS ?rel) BIND(0 AS ?prio) }
        UNION { ?subject wdt:${WD.basedOn} ?saga . ?work wdt:${WD.partOfSeries} ?saga . BIND("source" AS ?rel) BIND(0 AS ?prio) }
        UNION { ?subject wdt:${WD.basedOn} ?src . ?work wdt:${WD.basedOn} ?src . BIND("sibling" AS ?rel) BIND(2 AS ?prio) }
        UNION { ?subject wdt:${WD.basedOn} ?src2 . ?src2 wdt:${WD.derivativeWork} ?work . BIND("sibling" AS ?rel) BIND(2 AS ?prio) }
        UNION { ?subject wdt:${WD.mediaFranchise} ?fr . ?work wdt:${WD.mediaFranchise} ?fr . BIND("franchise" AS ?rel) BIND(3 AS ?prio) }
      }
      FILTER(?work != ?subject && ?work != ?seed)
    }
    LIMIT ${CANDIDATE_LIMIT}
  }
  OPTIONAL { ?work wdt:${WD.tmdbMovie} ?tmdbMovie }
  OPTIONAL { ?work wdt:${WD.tmdbTv} ?tmdbTv }
  OPTIONAL { ?work wdt:${WD.anilistAnime} ?alAnime }
  OPTIONAL { ?work wdt:${WD.anilistManga} ?alManga }
  OPTIONAL { ?work wdt:${WD.malAnime} ?malAnime }
  OPTIONAL { ?work wdt:${WD.malManga} ?malManga }
  OPTIONAL { ?work wdt:${WD.openLibrary} ?ol FILTER(STRSTARTS(?ol, "OL") && STRENDS(?ol, "W")) }
  OPTIONAL { ?work wdt:${WD.rawgGame} ?rawg }
  OPTIONAL { ?work wdt:${WD.comicVine} ?cv FILTER(STRSTARTS(?cv, "4000-")) }
  FILTER(BOUND(?tmdbMovie) || BOUND(?tmdbTv) || BOUND(?alAnime) || BOUND(?alManga) || BOUND(?malAnime) || BOUND(?malManga) || BOUND(?ol) || BOUND(?rawg) || BOUND(?cv))
  OPTIONAL { ?work wdt:${WD.publicationDate} ?date }
  OPTIONAL { ?work rdfs:label ?labelEs FILTER(LANG(?labelEs) = "es") }
  OPTIONAL { ?work rdfs:label ?labelEn FILTER(LANG(?labelEn) = "en") }
  OPTIONAL { ?work rdfs:label ?labelMul FILTER(LANG(?labelMul) = "mul") }
}
GROUP BY ?work
ORDER BY ?prio_ ?date_
LIMIT ${WIKIDATA_ROW_LIMIT}`;
}

// ── Respuesta ─────────────────────────────────────────────────────────────────

const term = z.looseObject({ type: z.string(), value: z.string() });

/** Contrato mínimo de una respuesta SPARQL JSON (W3C). */
export const sparqlResultsSchema = z.looseObject({
  head: z.looseObject({ vars: z.array(z.string()).optional() }).optional(),
  results: z.looseObject({ bindings: z.array(z.record(z.string(), term)) }),
});

export type SparqlBinding = Record<string, { type: string; value: string }>;

export interface SparqlResults {
  results: { bindings: SparqlBinding[] };
}

/** Valor de una variable de la fila (sin el prefijo de entidad en las URI). */
export function bindingValue(row: SparqlBinding, name: string): string | undefined {
  const cell = row[name] ?? row[`${name}_`];
  if (!cell || typeof cell.value !== "string") return undefined;
  return cell.type === "uri" ? cell.value.replace(/^https?:\/\/www\.wikidata\.org\/entity\//, "") : cell.value;
}

export interface SparqlOptions {
  /** `false` = sin caché de Next (la ficha usa la tabla); si no, `revalidate` en segundos. */
  cache: false | { revalidate: number };
  signal?: AbortSignal;
  /** Plazo por intento; por defecto WIKIDATA_TIMEOUT_MS (el de las fichas). */
  timeoutMs?: number;
}

/**
 * Ejecuta una consulta en WDQS por GET (cacheable y es lo que recomienda el
 * manual para consultas cortas) con plazo, contrato y circuito. Lanza
 * `ProviderError` si no responde o responde mal.
 */
export async function runSparql(query: string, opts: SparqlOptions): Promise<SparqlResults> {
  const url = `${WIKIDATA_SPARQL_ENDPOINT}?${new URLSearchParams({ query, format: "json" })}`;
  const json = await providerFetch<SparqlResults>(WIKIDATA_PROVIDER, url, {
    schema: sparqlResultsSchema,
    timeoutMs: opts.timeoutMs ?? WIKIDATA_TIMEOUT_MS,
    headers: { Accept: "application/sparql-results+json" },
    label: "sparql",
    cache: opts.cache,
    signal: opts.signal,
  });
  // En modo `log` el contrato avisa pero no lanza: sin `bindings` no hay nada.
  const bindings = Array.isArray(json?.results?.bindings) ? json.results.bindings : [];
  return { results: { bindings } };
}

/**
 * Consulta de la sonda: una fila constante y ninguna tripleta, así que WDQS
 * responde sin tocar el grafo (lo más barato que admite el servicio).
 */
export const WIKIDATA_PROBE_QUERY = "SELECT ?ok WHERE { BIND(1 AS ?ok) }";

/**
 * Plazo de la sonda: la consulta constante responde en milisegundos cuando
 * WDQS está bien; los 7 s de las fichas (franquicias grandes) harían que
 * `/api/health?deep=1` tardase eso cada vez que WDQS va lento.
 */
export const WIKIDATA_PROBE_TIMEOUT_MS = 2500;

/**
 * Sonda de `/api/health?deep=1`: misma ruta que las fichas (GET, User-Agent,
 * plazo, contrato y circuito de `providerFetch`), sin caché de datos.
 */
export async function probeWikidata(): Promise<void> {
  await runSparql(WIKIDATA_PROBE_QUERY, { cache: false, timeoutMs: WIKIDATA_PROBE_TIMEOUT_MS });
}
