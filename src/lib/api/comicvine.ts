// ============================================================
// KULTURA — ComicVine API client (cómics)
// SOLO server-side — COMICVINE_KEY nunca al cliente.
// ============================================================

import type { ComicVineIssue, ComicVineSearchResponse } from "@/types/media";
import type { MediaItem } from "@/types/media";
import { normalizeComic } from "@/lib/api/normalizer";
import { env } from "@/lib/env";
import {
  comicSort,
  comicCoverDateWindow,
  mapPublisherSubstrings,
  type ComicFilters,
} from "@/lib/api/comicvine-maps";
import { volumenesMin } from "@/lib/api/jikan-maps";
import {
  acceptsComicIssue,
  acceptsComicPublisher,
  COMIC_PUBLISHERS,
  MANGA_PUBLISHERS,
  ADULT_PUBLISHERS,
  isAllowedComicPublisher,
  isBlockedComicVolume,
  isMangaPublisher,
  isAdultPublisher,
  BLOCKED_COMIC_VOLUMES,
} from "@/lib/api/comic-publishers";

// E-COMIC-ALLOWLIST: la decisión de qué editorial entra en el catálogo vive en
// `comic-publishers.ts`. Se re-exporta desde aquí porque este módulo era su
// sitio histórico y varios consumidores (y sus tests) la importan de él.
export {
  acceptsComicIssue,
  acceptsComicPublisher,
  COMIC_PUBLISHERS,
  MANGA_PUBLISHERS,
  ADULT_PUBLISHERS,
  isAllowedComicPublisher,
  isBlockedComicVolume,
  isMangaPublisher,
  isAdultPublisher,
  BLOCKED_COMIC_VOLUMES,
};

/** Respuesta del endpoint de detalle /issue/4000-{id}/ (un único result objeto). */
interface ComicVineIssueResponse {
  status_code: number;
  error: string;
  results: ComicVineIssue | null;
}

const COMICVINE_BASE = "https://comicvine.gamespot.com/api";


/**
 * Cache module-level volumeId → publisherName. La relación volumen→editorial no
 * cambia nunca, así que se cachea indefinidamente durante la vida del proceso.
 */
const volumePublisherCache = new Map<number, string>();

/**
 * Cache module-level volumeId → count_of_issues (R4c-2). Como el publisher, el nº
 * de issues del volumen es estable; se resuelve en el MISMO batch a /volumes/ (sin
 * llamadas extra por item). 0 = desconocido/no devuelto.
 */
const volumeCountCache = new Map<number, number>();

/** Respuesta del endpoint /volumes/ (lista de volúmenes con publisher + count). */
interface ComicVineVolumesResponse {
  status_code: number;
  error: string;
  results:
    | Array<{
        id: number;
        publisher?: { id: number; name: string } | null;
        count_of_issues?: number;
      }>
    | null;
}

function getKey(): string {
  // Opcional en el schema: graceful, throw lazy solo si se usa sin configurar.
  const key = env.COMICVINE_KEY;
  if (!key) throw new Error("COMICVINE_KEY no configurada");
  return key;
}

async function comicVineFetch<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${COMICVINE_BASE}${path}`);
  url.searchParams.set("api_key", getKey());
  url.searchParams.set("format", "json");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  // ComicVine rechaza peticiones sin User-Agent identificable.
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "KulturaApp/1.0" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`ComicVine ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * Busca issues de cómic. Usa el endpoint /issues con filtro por nombre,
 * que devuelve la carátula (image) directamente, a diferencia de /search.
 */
export async function searchComics(
  query: string,
  page = 1
): Promise<ComicVineSearchResponse> {
  return comicVineFetch<ComicVineSearchResponse>("/issues/", {
    filter: `name:${query}`,
    limit: "20",
    // E-DISCOVER-SEARCH-MERGE: paginación por offset, el mismo mecanismo que ya
    // usa `getRecentComics`. Antes solo servía la primera página.
    offset: String((page - 1) * 20),
    sort: "cover_date:desc",
    field_list: "id,name,issue_number,cover_date,store_date,deck,description,image,volume",
  });
}

/**
 * Detalle de un issue concreto. El recurso ComicVine usa el prefijo de tipo
 * 4000 para los issues: /issue/4000-{externalId}/. Lanza si no hay results.
 */
export async function getComic(externalId: string): Promise<ComicVineIssue> {
  const resp = await comicVineFetch<ComicVineIssueResponse>(
    `/issue/4000-${externalId}/`,
    {
      field_list: "id,name,issue_number,cover_date,store_date,deck,image,volume",
    }
  );
  if (!resp.results) throw new Error(`ComicVine issue ${externalId} sin results`);
  return resp.results;
}

/**
 * Resuelve el publisher de cada volumen vía batch al endpoint /volumes/.
 * El objeto `volume` inline de /issues/ NO incluye publisher, así que hay que
 * pedirlo aparte. Cachea en memoria (volume→publisher es inmutable) y solo
 * pide los ids no cacheados. Devuelve Map<volumeId, publisherName>.
 */
export async function resolveVolumePublishers(
  volumeIds: number[]
): Promise<Map<number, string>> {
  const unique = volumeIds.filter((id, i) => volumeIds.indexOf(id) === i);
  const missing = unique.filter((id) => !volumePublisherCache.has(id));

  if (missing.length > 0) {
    const resp = await comicVineFetch<ComicVineVolumesResponse>("/volumes/", {
      filter: `id:${missing.join("|")}`,
      // R4c-2: count_of_issues se pide en el MISMO batch (sin fetch extra por item).
      field_list: "id,publisher,count_of_issues",
      limit: "100",
    });
    for (const vol of resp.results ?? []) {
      volumePublisherCache.set(vol.id, vol.publisher?.name ?? "");
      volumeCountCache.set(
        vol.id,
        typeof vol.count_of_issues === "number" ? vol.count_of_issues : 0
      );
    }
    // Marca como vacíos los ids que la API no devolvió, para no re-pedirlos.
    for (const id of missing) {
      if (!volumePublisherCache.has(id)) volumePublisherCache.set(id, "");
      if (!volumeCountCache.has(id)) volumeCountCache.set(id, 0);
    }
  }

  const result = new Map<number, string>();
  for (const id of unique) {
    result.set(id, volumePublisherCache.get(id) ?? "");
  }
  return result;
}

/**
 * Map volumeId → count_of_issues, leyendo de la cache que llena
 * resolveVolumePublishers. Debe llamarse DESPUÉS de aquél (mismo batch).
 */
function getVolumeCounts(volumeIds: number[]): Map<number, number> {
  const result = new Map<number, number>();
  for (const id of volumeIds) {
    result.set(id, volumeCountCache.get(id) ?? 0);
  }
  return result;
}

/** Tope de resultados por petición de ComicVine. */
export const COMIC_WINDOW = 100;

/**
 * Ventanas de 100 que puede mirar UNA página antes de rendirse
 * (E-COMIC-VENTANA). Cada página cubre por tanto `COMIC_WINDOW *
 * COMIC_WINDOWS_PER_PAGE` issues del proveedor.
 */
export const COMIC_WINDOWS_PER_PAGE = 3;

/** Issues que se enseñan por página. */
export const COMIC_PAGE_SIZE = 20;

/** Issues del proveedor que consume cada página (= su zancada de offset). */
export const COMIC_PAGE_STRIDE = COMIC_WINDOW * COMIC_WINDOWS_PER_PAGE;

/**
 * Techo de páginas del catálogo de cómic (E-COMIC-PROFUNDIDAD), por debajo del
 * tope común `DISCOVER_MAX_PAGES` de las otras seis familias.
 *
 * El cómic es la única familia cuya página N no lee la página N del proveedor,
 * sino el offset `(N-1) × 300`: con el tope común, la página 100 pedía a partir
 * del issue 29.700 ordenado por `cover_date:desc`. A esa profundidad ya no hay
 * catálogo occidental reciente —lo que queda es el fondo que la lista blanca
 * descarta—, así que esas páginas salían cortas, vacías o, antes de
 * E-COMIC-ALLOWLIST, llenas de lo que la lista negra no enumeraba.
 *
 * ¿Por qué 20? 20 × 20 = 400 cómics ofrecidos, consumiendo hasta 6.000 issues
 * del proveedor. Es un parámetro de UX, no de marca: hay que anunciar las
 * páginas que de verdad traen cómic, y ofrecer cien para que noventa estén
 * vacías es la misma clase de mentira que ya se corrigió al dividir el conteo
 * por la ventana en vez de por lo que se enseña. El coste por página también
 * pesa: hasta 6 de las ~200 peticiones/hora que permite ComicVine.
 *
 * Es un techo estimado, no medido contra la API viva (el proxy de estas
 * sesiones bloquea `comicvine.gamespot.com`): si en preview la página 20 sigue
 * llegando llena, sube; si se vacía antes, baja.
 */
export const COMIC_MAX_PAGES = 20;

/**
 * Issues recientes ordenados por fecha de portada descendente, quedándose SOLO
 * con las editoriales de la lista blanca del catálogo (E-COMIC-ALLOWLIST: US +
 * BD franco-belga + UK + ES/LatAm + Italia + clásicos). Issues sin publisher
 * resuelto se descartan (la mayoría del manga llega así).
 *
 * E-COMIC-VENTANA: una página mira hasta TRES ventanas de 100 y para en cuanto
 * junta 20 items. Antes miraba una sola, y con el tope de fechas
 * (E-CATALOGO-FUTURO) eso dejó la página 1 en CINCO cómics: sin tope, los 100
 * primeros por `cover_date:desc` eran solicitaciones futuras de las grandes
 * editoriales americanas —que sobreviven bien al filtro—, y con tope pasaron a
 * ser los 100 más recientes ya publicados, donde ComicVine está lleno de
 * volúmenes de manga que el filtro descarta. El tope no rompió nada: destapó
 * que el filtro se come el grueso de lo que de verdad es reciente.
 *
 * El coste está acotado a propósito (ComicVine limita a ~200 peticiones/hora):
 * como mucho 3 peticiones de issues + 3 de volúmenes por página, y se corta en
 * cuanto hay suficiente o el proveedor se queda sin resultados.
 */
export async function getRecentComics(
  page: number = 1,
  filters: ComicFilters = {}
): Promise<{ items: MediaItem[]; total: number }> {
  const baseOffset = (page - 1) * COMIC_PAGE_STRIDE;
  const collected: MediaItem[] = [];
  let total = 0;

  for (let window = 0; window < COMIC_WINDOWS_PER_PAGE; window++) {
    const batch = await fetchComicWindow(
      baseOffset + window * COMIC_WINDOW,
      filters
    );
    total = batch.total || total;
    collected.push(...batch.items);

    // Suficiente para llenar la página, o el proveedor ya no tiene más que dar.
    if (collected.length >= COMIC_PAGE_SIZE || !batch.hasMore) break;
  }

  return { items: collected.slice(0, COMIC_PAGE_SIZE), total };
}

/**
 * Una ventana de `COMIC_WINDOW` issues ya post-filtrados. `hasMore` dice si el
 * proveedor devolvió la ventana COMPLETA (y por tanto puede quedar más detrás),
 * no si sobrevivió algo — son cosas distintas y confundirlas era lo que dejaba
 * la paginación mintiendo.
 */
async function fetchComicWindow(
  offset: number,
  filters: ComicFilters
): Promise<{ items: MediaItem[]; total: number; hasMore: boolean }> {
  // Con filtros → sort dinámico + filter cover_date si year. Sin filtros →
  // params idénticos a hoy (paridad). genre sigue oculto para comic.
  const params: Record<string, string> = {
    sort: comicSort(filters.sort),
    limit: String(COMIC_WINDOW),
    offset: String(offset),
    field_list: "id,name,issue_number,cover_date,store_date,deck,image,volume",
  };
  // E-CATALOGO-FUTURO: `filter` de fecha SIEMPRE presente (antes solo con año).
  // Las portadas se fechan con meses de adelanto, así que sin tope la primera
  // página de "Más recientes" son números que aún no han salido.
  params.filter = comicCoverDateWindow(filters.year);

  const resp = await comicVineFetch<ComicVineSearchResponse>("/issues/", params);
  if (!resp.results) return { items: [], total: 0, hasMore: false };

  const volumeIds = resp.results
    .map((issue) => issue.volume?.id)
    .filter((id): id is number => typeof id === "number");
  const publishers = await resolveVolumePublishers(volumeIds);
  // count_of_issues sale de la cache que llena resolveVolumePublishers (mismo
  // batch, sin fetch extra). Solo se usa si se pidió el filtro volumenes.
  const volumeCounts = getVolumeCounts(volumeIds);

  // Editorial = post-filtro sobre el publisher resuelto (substring, case-insensitive).
  const publisherSubstrings = mapPublisherSubstrings(filters.editorial).map((p) =>
    p.toLowerCase()
  );

  // Volumenes×comic (R4c-2): umbral mínimo de count_of_issues según bucket.
  const minVolumes = volumenesMin(filters.volumenes);

  const allowed = resp.results.filter((issue) => {
    const publisher = issue.volume?.id
      ? publishers.get(issue.volume.id)
      : undefined;
    // E-COMIC-ALLOWLIST: solo entra el publisher que está en la lista blanca
    // (`comic-publishers.ts`), y de ahí caen los sellos de manga o adultos que
    // hereden un nombre permitido. Los issues sin publisher resuelto se
    // descartan igual que antes: en ComicVine el grueso del manga llega así.
    //
    // E-COMIC-SERIE-ADULTA: y además el veto por SERIE, que es lo único que
    // separa un álbum erótico del resto del catálogo de su misma editorial.
    // `volume.name` ya viene en el field_list, así que no cuesta una petición.
    if (!publisher) return false;
    if (!acceptsComicIssue({ publisher, volume: issue.volume?.name })) return false;
    // Editorial (si se pidió): mantener solo si el publisher incluye algún substring.
    if (publisherSubstrings.length > 0) {
      const lc = publisher.toLowerCase();
      if (!publisherSubstrings.some((sub) => lc.includes(sub))) return false;
    }
    // Volumenes (si se pidió): count_of_issues del volumen >= umbral del bucket.
    // Issues sin count resuelto (0) se descartan cuando hay umbral.
    if (minVolumes !== null) {
      const count = issue.volume?.id ? volumeCounts.get(issue.volume.id) ?? 0 : 0;
      if (count < minVolumes) return false;
    }
    return true;
  });

  return {
    items: allowed.map(normalizeComic),
    total: resp.number_of_total_results ?? 0,
    hasMore: resp.results.length >= COMIC_WINDOW,
  };
}
