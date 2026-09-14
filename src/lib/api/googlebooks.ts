// ============================================================
// KULTURA — Google Books API Integration (E-BOOKS-GOOGLE)
// Libros (fuente principal) via Google Books API v1
// Docs: https://developers.google.com/books/docs/v1/using
//
// Decisión de producto (2026-09-12): los libros VUELVEN a Google Books desde
// Open Library (que los sirvió entre E84c y hoy). Motivo: catálogo mucho mayor
// y, sobre todo, portadas + sinopsis + metadatos en ambos idiomas, con
// `langRestrict` atado al locale activo — Open Library solo permite acotar por
// `language:<ISO-639-3>` y su cobertura de sinopsis en español es marginal.
// Reversión deliberada; `openlibrary.ts` se conserva SOLO como resolutor de los
// ids legacy ya guardados en bibliotecas (ver `isOpenLibraryLegacyId`).
//
// AUTENTICACIÓN — `GOOGLE_BOOKS_KEY` es OPCIONAL en el esquema de env (mismo
// patrón que `COMICVINE_KEY`) y el cliente funciona sin ella, pero:
//   ⚠️ verificado el 2026-09-12 con `curl` desde este entorno, SIN key, la API
//   responde 429 `RESOURCE_EXHAUSTED` con `quota_limit_value: "0"` →
//   "Quota exceeded … 'Queries per day'". Es decir: el acceso anónimo comparte
//   cuota por IP de salida y puede estar a CERO (caso típico en IPs de cloud,
//   como las de Vercel). La key no es un requisito de la API, pero SÍ lo es en
//   la práctica para que el catálogo de libros responda en producción.
//   Sin key el cliente no rompe: lanza como cualquier fallo de red y la capa de
//   Descubrir lo convierte en `fetchErrorKind` (banner), no en pantalla roja.
// ============================================================

import { env } from "@/lib/env";
import { googleBooksLangRestrict } from "@/lib/api/locale";

const GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1";

/** Resultados por página (= page-size del resto de familias de Descubrir). */
export const GOOGLE_BOOKS_PAGE_SIZE = 20;

// ── Internal types ────────────────────────────────────────────────────────────

export interface GoogleBooksImageLinks {
  smallThumbnail?: string;
  thumbnail?: string;
  small?: string;
  medium?: string;
  large?: string;
  extraLarge?: string;
}

export interface GoogleBooksVolumeInfo {
  title?: string;
  subtitle?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string; // "2003" | "2003-05-01"
  description?: string;
  pageCount?: number;
  categories?: string[];
  averageRating?: number; // 1-5
  ratingsCount?: number;
  language?: string; // ISO-639-1
  imageLinks?: GoogleBooksImageLinks;
  industryIdentifiers?: { type: string; identifier: string }[];
}

export interface GoogleBooksVolume {
  id: string;
  volumeInfo?: GoogleBooksVolumeInfo;
  saleInfo?: { saleability?: string; isEbook?: boolean };
  accessInfo?: { epub?: { isAvailable?: boolean }; pdf?: { isAvailable?: boolean } };
}

export interface GoogleBooksResponse {
  /** Estimación del total: Google la ajusta entre páginas, ver `googleBooksTotalPages`. */
  totalItems: number;
  /** Ausente (no `[]`) cuando no hay resultados — de ahí el `?? []` en los consumidores. */
  items?: GoogleBooksVolume[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Portada del volumen. Google devuelve las miniaturas con esquema **http** en
 * muchos volúmenes; se fuerza `https` (si no, `img-src`/mixed-content las
 * bloquea) y se pide `zoom=1` para la variante grande cuando la URL es del
 * endpoint `books/content` (las miniaturas por defecto son ~128px y se ven
 * borrosas en una card 2:3).
 */
export function googleBooksCover(
  links: GoogleBooksImageLinks | undefined
): string | undefined {
  const raw =
    links?.extraLarge ??
    links?.large ??
    links?.medium ??
    links?.thumbnail ??
    links?.small ??
    links?.smallThumbnail;
  if (!raw) return undefined;
  const https = raw.replace(/^http:\/\//i, "https://");
  return https.includes("books/content")
    ? https.replace(/([?&])zoom=\d+/, "$1zoom=1")
    : https;
}

/**
 * `totalItems` → páginas navegables. Google Books:
 *   - reporta `totalItems` como ESTIMACIÓN (puede variar entre páginas), y
 *   - deja de servir resultados bastante antes de ese total.
 * El cap real lo aplica la capa de Descubrir (`DISCOVER_MAX_PAGES`), aquí solo
 * se traduce el total a páginas con el page-size del proyecto.
 */
export function googleBooksTotalPages(totalItems: number | undefined): number {
  if (!totalItems || totalItems <= 0) return 1;
  return Math.max(Math.ceil(totalItems / GOOGLE_BOOKS_PAGE_SIZE), 1);
}

/** `page` (1-indexed) → `startIndex` (0-indexed) de Google Books. */
export function googleBooksStartIndex(page: number): number {
  return Math.max(0, (page - 1) * GOOGLE_BOOKS_PAGE_SIZE);
}

/**
 * ¿Es un id legacy de Open Library (`OL7353617W` / `OL123M`)? Las bibliotecas
 * creadas mientras los libros venían de Open Library (E84b/E84c) guardaron
 * `book_OL…` en la tabla `media`; los ids de Google Books son alfanuméricos de
 * 12 caracteres (`wrOQLV6xB-wC`). La ficha enruta por esta forma para no
 * romper lo ya guardado — ver `media/[type]/[id]/page.tsx`.
 */
export function isOpenLibraryLegacyId(id: string): boolean {
  return /^(\/works\/)?OL\d+[WM]$/i.test(id);
}

/**
 * Error de Google Books con el STATUS accesible.
 *
 * Antes se lanzaba un `Error` plano con el código solo dentro del mensaje, así
 * que quien lo capturaba no podía distinguir un 429 (cuota agotada: transitorio
 * y con mensaje propio para el usuario) de un 400 o un 503. Mismo patrón que
 * `JikanError` y `AniListError`.
 */
export class GoogleBooksError extends Error {
  readonly status: number;

  constructor(path: string, status: number) {
    super(`Google Books ${path} → ${status}`);
    this.name = "GoogleBooksError";
    this.status = status;
  }
}

async function googleBooksFetch<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${GOOGLE_BOOKS_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  // Key OPCIONAL (esquema Zod, mismo patrón que COMICVINE_KEY): se añade solo
  // si está configurada. A diferencia de ComicVine, aquí NO se lanza cuando
  // falta: la API pública responde sin key (con la cuota compartida de la nota
  // de cabecera), así que se intenta la petición igualmente.
  const key = env.GOOGLE_BOOKS_KEY;
  if (key) url.searchParams.set("key", key);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new GoogleBooksError(path, res.status);
  }
  return res.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Busca volúmenes. `q` es la query de Google Books (admite operadores
 * `subject:`, `inpublisher:`, `intitle:`…, ver `books-maps.ts`).
 * `langRestrict` se deriva del locale activo → catálogo en el idioma de la app.
 */
export async function searchGoogleBooks(
  q: string,
  page = 1,
  params: Record<string, string> = {},
  locale?: string | null
): Promise<GoogleBooksResponse> {
  return googleBooksFetch<GoogleBooksResponse>("/volumes", {
    q,
    startIndex: String(googleBooksStartIndex(page)),
    maxResults: String(GOOGLE_BOOKS_PAGE_SIZE),
    langRestrict: googleBooksLangRestrict(locale),
    printType: "books",
    ...params,
  });
}

/**
 * Detalle de un volumen por id. `null` si Google responde 404 (id inexistente)
 * → el caller hace `notFound()` en vez de propagar un error 500.
 * NO se aplica `langRestrict`: es un filtro de BÚSQUEDA, y pedir una ficha
 * concreta debe devolverla aunque su idioma no sea el activo.
 */
export async function getGoogleBookDetail(
  id: string
): Promise<GoogleBooksVolume | null> {
  try {
    return await googleBooksFetch<GoogleBooksVolume>(`/volumes/${id}`);
  } catch (e) {
    if (e instanceof GoogleBooksError && e.status === 404) return null;
    throw e;
  }
}
