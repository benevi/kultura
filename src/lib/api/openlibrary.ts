// ============================================================
// KULTURA — Open Library API Integration (E-BOOKS-HIBRIDO)
// CATÁLOGO de libros (Descubrir) via Open Library Search API.
// Docs: https://openlibrary.org/developers/api — no requiere API key.
//
// Reparto de papeles (decisión de producto, 2026-09-14): cada proveedor donde
// es bueno.
//   - Open Library → CATÁLOGO. Es el único de los dos con filtros de verdad:
//     `language` como facet, `first_publish_year:[a TO b]` como rango, `sort`
//     nativo y un `numFound` fiable del que sí se puede derivar la paginación.
//     Y sin clave ni cuota, que es lo que dejaba el catálogo caído en Vercel.
//   - Google Books → FICHA. Mejores portadas y sinopsis; se consulta solo al
//     abrir un título, no al listar (ver `enrichBookWithGoogle`).
//
// Historia: los libros vivieron aquí (E84c), se migraron a Google Books
// (E-BOOKS-GOOGLE, 2026-09-12) porque su cobertura de sinopsis en español es
// marginal, y vuelven al catálogo ahora que existe la capa de traducción
// (`media_translations`) — ese motivo ya no obliga a renunciar a los filtros.
// ============================================================

// ── Internal types ────────────────────────────────────────────────────────────

import type { ZodType } from "zod";
import { providerFetch, PROVIDER_MAX_TIMEOUT_MS } from "@/lib/api/http";
import {
  openLibraryAuthorSchema,
  openLibraryEditionsSchema,
  openLibrarySearchSchema,
  openLibraryWorkSchema,
} from "@/lib/api/schemas/openlibrary";

export interface OpenLibraryDoc {
  key: string; // "/works/OL7353617W"
  isbn?: string[];
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number; // cover: https://covers.openlibrary.org/b/id/{cover_i}-L.jpg
  language?: string[];
  publisher?: string[];
  subject?: string[];
  ebook_access?: string;
}

export interface OpenLibraryResponse {
  docs: OpenLibraryDoc[];
  /**
   * Total REAL de resultados, no una estimación. Es la diferencia práctica con
   * `totalItems` de Google Books, que anunciaba cientos de páginas que luego el
   * proveedor rechazaba.
   */
  numFound: number;
}

export interface OpenLibraryWork {
  key?: string;
  title?: string;
  description?: string | { value: string };
  authors?: { author?: { key: string } }[];
  covers?: number[];
  subjects?: string[];
  first_publish_date?: string;
}

interface OpenLibraryEdition {
  covers?: number[];
  isbn_13?: string[];
  isbn_10?: string[];
  publishers?: string[];
  languages?: { key: string }[];
  publish_date?: string;
}

// ── Campos: el LISTADO no pide `isbn`, la FICHA sí (E-BOOKS-ISBN) ────────────
//
// `isbn` es lo que tumbaba el catálogo. Open Library devuelve TODOS los ISBN de
// TODAS las ediciones de una obra, y la consulta ancha del catálogo
// (`subject:"fiction"`) abre por los clásicos — Frankenstein, Drácula, Dorian
// Gray — que acumulan miles de ediciones. Pedir ese campo para 20-60 obras a la
// vez genera una respuesta que el proveedor no llega a servir: corta la
// conexión, y en el log sale como `TypeError: terminated · cause=SocketError:
// other side closed`, no como un 4xx.
//
// Medido contra la API viva, misma consulta y mismo `limit`: con `isbn` falla
// con limit 60 y con limit 20; sin `isbn` responde con 60 aunque se pidan
// `subject` y `publisher`, que también son arrays grandes. Es ese campo, no el
// tamaño de página ni el rango de años.
//
// El ISBN se sigue necesitando para puentear a Google Books en la ficha
// (emparejar por título+autor es ambiguo entre ediciones), pero ahí se pide
// para UN solo documento, donde no hay problema de tamaño.
const LIST_FIELDS =
  "key,title,author_name,first_publish_year,cover_i,language,publisher,subject,ebook_access";
const DETAIL_FIELDS = `${LIST_FIELDS},isbn`;

// ── Helper ────────────────────────────────────────────────────────────────────

export function openLibraryCover(coverId: number): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
}

/**
 * Error de Open Library con el STATUS accesible, igual que `JikanError`,
 * `AniListError` y `GoogleBooksError`.
 *
 * Un `Error` plano con el código dentro del texto obliga a leer el mensaje con
 * una regex para saber si fue cuota, consulta inválida o caída — y en un log de
 * producción eso se traduce en no saberlo.
 */
export class OpenLibraryError extends Error {
  readonly status: number;

  constructor(path: string, status: number) {
    super(`Open Library ${path} → ${status}`);
    this.name = "OpenLibraryError";
    this.status = status;
  }
}

/**
 * Plazo máximo por petición. Sin él, una conexión que se queda a medias deja la
 * función serverless esperando hasta que Vercel la mata, y el log no dice nada
 * útil. Con él, el fallo es rápido y nombra la causa. Son 8 s y no los 6 s
 * comunes: la ventana del catálogo (60 obras) es la respuesta más pesada de
 * todos los proveedores y, como un plazo agotado cuenta para el circuit
 * breaker, 6 s abrirían el circuito con picos lentos de un servicio que está
 * vivo.
 */
export const OPEN_LIBRARY_TIMEOUT_MS = PROVIDER_MAX_TIMEOUT_MS;

/** Ruta sin ids para el log y las métricas. */
function providerLabel(path: string): string {
  if (path.startsWith("/authors/")) return "/authors/{id}.json";
  if (path.endsWith("/editions.json")) return "/works/{id}/editions.json";
  if (path.startsWith("/works/")) return "/works/{id}.json";
  return path;
}

async function openLibraryFetch<T>(
  path: string,
  params: Record<string, string> = {},
  schema?: ZodType,
  cache?: false,
  signal?: AbortSignal
): Promise<T> {
  const url = new URL(`https://openlibrary.org${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  // Open Library pide un User-Agent identificable: lo pone `providerFetch`.
  return providerFetch<T>("openlibrary", url.toString(), {
    schema,
    label: providerLabel(path),
    timeoutMs: OPEN_LIBRARY_TIMEOUT_MS,
    httpError: (status) => new OpenLibraryError(path, status),
    ...(cache === false ? { cache: false as const } : {}),
    ...(signal ? { signal } : {}),
  });
}

/** Sonda barata para `/api/health?deep=1`: un resultado y un solo campo. */
export async function probeOpenLibrary(): Promise<void> {
  await openLibraryFetch(
    "/search.json",
    { q: "dune", limit: "1", fields: "key" },
    openLibrarySearchSchema,
    false
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Resultados por página del BUSCADOR (= page-size del resto de familias). */
export const OPEN_LIBRARY_PAGE_SIZE = 20;

/**
 * Cuántos registros pide cada página del CATÁLOGO de Descubrir
 * (E-BOOKS-VENTANA).
 *
 * Más de los que se enseñan, a propósito. El catálogo descarta los libros sin
 * portada (E-BOOKS-PORTADA) y ese recorte no es uniforme: ordenando por "Más
 * recientes", lo más nuevo de Open Library son autopublicaciones sin portada,
 * así que de 20 registros llegaba a sobrevivir UNO y la página quedaba
 * prácticamente vacía.
 *
 * Con una ventana más ancha el recorte deja material suficiente, y sigue
 * costando UNA sola petición: lo que cambia es el tamaño de la respuesta, no
 * el número de llamadas. Open Library admite `limit` hasta 100; 60 da margen
 * de sobra sin traer payloads innecesarios.
 */
export const OPEN_LIBRARY_CATALOG_WINDOW = 60;

/**
 * Cuántas ventanas puede mirar UNA página del catálogo antes de rendirse
 * (E-BOOKS-PAGINA-FIJA).
 *
 * La ventana de 60 era un presupuesto fijo con rendimiento VARIABLE: la página
 * enseñaba "lo que sobreviviera", y según la ordenación eso iban de 5 libros a
 * 40. Visto en pantalla: una página con CINCO y otra con la rejilla llena, con
 * los mismos filtros.
 *
 * Es el mismo problema que el cómic ya resolvió (E-COMIC-VENTANA) y se resuelve
 * igual: pedir ventanas hasta juntar una página, con el presupuesto acotado.
 * Open Library no exige clave ni documenta un límite por hora como el de
 * ComicVine, así que 3 ventanas son baratas; el corte es por si una consulta
 * tiene un rendimiento malísimo, para no encadenar peticiones sin fin.
 */
export const OPEN_LIBRARY_WINDOWS_PER_PAGE = 3;

/**
 * Lo que CONSUME una página del catálogo, se enseñe lo que se enseñe. Es lo que
 * determina dónde empieza la siguiente, así que es el divisor del conteo de
 * páginas — igual que `COMIC_PAGE_STRIDE`. Dividir por lo que se ENSEÑA
 * anunciaría páginas que ya se han recorrido.
 */
export const OPEN_LIBRARY_PAGE_STRIDE =
  OPEN_LIBRARY_CATALOG_WINDOW * OPEN_LIBRARY_WINDOWS_PER_PAGE;

/**
 * Busca en el catálogo. `params` admite los filtros nativos de Open Library
 * (`language`, `sort`, `has_fulltext`…), que a diferencia de Google Books son
 * filtros de verdad y no pistas para el índice.
 *
 * `limit` permite pedir una ventana más ancha que la que se va a enseñar,
 * para que un post-filtro no deje la rejilla vacía.
 */
export async function searchOpenLibrary(
  q: string,
  page = 1,
  params: Record<string, string> = {},
  limit = OPEN_LIBRARY_PAGE_SIZE,
  /**
   * E-BOOKS-ISBN: por defecto SIN `isbn`. Solo la ficha lo pide, y lo hace
   * para un único documento.
   */
  fields: string = LIST_FIELDS,
  /** F-13: cancela la petición (la que pierde la carrera con `title=`). */
  signal?: AbortSignal
): Promise<OpenLibraryResponse> {
  return openLibraryFetch<OpenLibraryResponse>(
    "/search.json",
    {
      q,
      page: String(Math.max(1, page)),
      limit: String(limit),
      fields,
      ...params,
    },
    openLibrarySearchSchema,
    undefined,
    signal
  );
}

/**
 * Búsqueda por TÍTULO (`title=`) en vez de general (`q=`). Medido el
 * 2026-10-23: 0,1-0,9 s cuando `q=` tarda 4-8 s en sus picos (la general
 * busca también en autores, temas y texto). Es el respaldo de la búsqueda
 * de libros cuando `q=` no responde a tiempo (`search.ts`).
 */
export async function searchOpenLibraryByTitle(
  title: string,
  page = 1,
  limit = OPEN_LIBRARY_PAGE_SIZE,
  signal?: AbortSignal
): Promise<OpenLibraryResponse> {
  return openLibraryFetch<OpenLibraryResponse>(
    "/search.json",
    {
      title,
      page: String(Math.max(1, page)),
      limit: String(limit),
      fields: LIST_FIELDS,
    },
    openLibrarySearchSchema,
    undefined,
    signal
  );
}

/**
 * `numFound` → páginas navegables. El total es real, así que el cálculo sirve;
 * `pageSize` debe ser la VENTANA que consume cada página, no lo que se enseña,
 * porque es lo que determina por dónde empieza la siguiente.
 */
export function openLibraryTotalPages(
  numFound: number | undefined,
  pageSize = OPEN_LIBRARY_PAGE_SIZE
): number {
  if (!numFound || numFound <= 0) return 1;
  return Math.max(Math.ceil(numFound / pageSize), 1);
}

/** Normaliza la description de un work: OL la devuelve como string o { value }. */
function workDescription(
  desc: string | { value: string } | undefined
): string | undefined {
  if (!desc) return undefined;
  return typeof desc === "string" ? desc : desc.value;
}

export interface OpenLibraryBookDetail {
  doc: OpenLibraryDoc;
  description?: string;
}

/** Primer año de cuatro cifras de una fecha libre de Open Library ("Feb 3, 2026"). */
function yearFrom(date: string | undefined): number | undefined {
  const m = date?.match(/\b(\d{4})\b/);
  return m ? Number(m[1]) : undefined;
}

/**
 * Respaldo de la ficha cuando `search.json` no responde (17-11-2026: desde
 * Vercel la búsqueda por `key:` agotaba los 8 s a ratos y abría el circuito,
 * mientras `/works/{id}.json` respondía en menos de un segundo). Monta el mismo
 * `OpenLibraryDoc` con la obra, su primera edición (portada, ISBN, editorial,
 * idioma) y los nombres de hasta tres autores. Edición y autores son
 * best-effort: sin ellos la ficha sale igual, con menos datos.
 */
async function docFromWork(
  workKey: string,
  work: OpenLibraryWork
): Promise<OpenLibraryDoc | null> {
  const title = work.title?.trim();
  if (!title) return null;
  const authorKeys = (work.authors ?? [])
    .map((a) => a.author?.key)
    .filter((k): k is string => typeof k === "string" && k.startsWith("/authors/"))
    .slice(0, 3);
  const [editions, ...authors] = await Promise.allSettled([
    openLibraryFetch<{ entries?: OpenLibraryEdition[] }>(
      `${workKey}/editions.json`,
      { limit: "1" },
      openLibraryEditionsSchema
    ),
    ...authorKeys.map((k) =>
      openLibraryFetch<{ name?: string }>(`${k}.json`, {}, openLibraryAuthorSchema)
    ),
  ]);
  const edition =
    editions.status === "fulfilled"
      ? (editions.value as { entries?: OpenLibraryEdition[] }).entries?.[0]
      : undefined;
  const authorNames = authors
    .map((r) => (r.status === "fulfilled" ? (r.value as { name?: string }).name?.trim() : undefined))
    .filter((n): n is string => !!n);
  const isbn = [...(edition?.isbn_13 ?? []), ...(edition?.isbn_10 ?? [])];
  const language = edition?.languages
    ?.map((l) => l.key.replace(/^\/languages\//, ""))
    .filter(Boolean);
  const coverId = [...(work.covers ?? []), ...(edition?.covers ?? [])].find((c) => c > 0);
  const year = yearFrom(work.first_publish_date) ?? yearFrom(edition?.publish_date);

  return {
    key: workKey,
    title,
    ...(authorNames.length ? { author_name: authorNames } : {}),
    ...(year ? { first_publish_year: year } : {}),
    ...(coverId ? { cover_i: coverId } : {}),
    ...(language?.length ? { language } : {}),
    ...(edition?.publishers?.length ? { publisher: edition.publishers } : {}),
    ...(work.subjects?.length ? { subject: work.subjects } : {}),
    ...(isbn.length ? { isbn } : {}),
  };
}

/**
 * Detalle de libro (E84c). id = workKey ("OL7353617W" o "/works/OL7353617W").
 * Se piden a la vez:
 * 1) search-by-key (q=key:/works/{id}) → OpenLibraryDoc completo (cover, autor,
 *    año, subjects) coherente con la grid → normalizeBookOpenLibrary.
 * 2) /works/{key}.json → description (no la trae el search).
 * Si el search responde sin docs → null (el caller hace notFound). Si el search
 * FALLA (plazo, red, 5xx) y la obra sí llegó, la ficha se monta con la obra
 * (`docFromWork`). Si fallan los dos, se lanza el error del search.
 */
export async function getBookDetail(
  id: string
): Promise<OpenLibraryBookDetail | null> {
  const workKey = id.startsWith("/works/") ? id : `/works/${id}`;
  // E-BOOKS-ISBN: la ficha SÍ pide `isbn` — es lo que permite puentear a Google
  // Books sin emparejar por título — y aquí es seguro: un solo documento.
  const [search, workRes] = await Promise.allSettled([
    searchOpenLibrary(`key:${workKey}`, 1, {}, OPEN_LIBRARY_PAGE_SIZE, DETAIL_FIELDS),
    openLibraryFetch<OpenLibraryWork>(`${workKey}.json`, {}, openLibraryWorkSchema),
  ]);
  const work = workRes.status === "fulfilled" ? workRes.value : undefined;
  const description = workDescription(work?.description);

  if (search.status === "fulfilled") {
    const doc = search.value.docs?.[0];
    return doc ? { doc, description } : null;
  }
  const doc = work ? await docFromWork(workKey, work) : null;
  if (!doc) throw search.reason;
  return { doc, description };
}
