// ============================================================
// KULTURA — Traducción de filtros a la query de Open Library (E-BOOKS-HIBRIDO)
//
// Traduce el contrato canónico de filtros de Descubrir a lo que entiende
// `/search.json`:
//   género  → subject:"<término>"                (fragmento de q)
//   año     → first_publish_year:[a TO b]        (fragmento de q, RANGO real)
//   idioma  → params.language (ISO-639-2/B)      (facet, no una pista)
//   formato → params.has_fulltext                (solo "libre")
//   sort    → params.sort
//
// La diferencia de fondo con las tablas de Google Books (`books-maps.ts`) es
// que aquí todo son filtros de verdad, aplicados por el proveedor. Allí el
// idioma era una pista para el índice y el año no existía siquiera, así que
// ambos había que aplicarlos a mano sobre lo ya recibido — de donde salían las
// páginas medio vacías y los títulos en un idioma que no era el pedido.
// ============================================================

import { todayYear } from "@/lib/api/catalog-window";

import { resolveApiLocale } from "@/lib/api/locale";

// ── Géneros (slug canónico Kultura → término subject: de Open Library) ───────
// Los subjects de Open Library son texto en inglés en minúscula, no códigos
// BISAC: "science fiction", no "Science Fiction". Se mantiene el MISMO juego de
// slugs que el resto de familias para que el filtro de género signifique lo
// mismo en todas las pestañas.

export const OPEN_LIBRARY_GENRE: Record<string, string> = {
  accion: "adventure",
  aventura: "adventure",
  comedia: "humor",
  crimen: "crime",
  drama: "drama",
  fantasia: "fantasy",
  historia: "history",
  terror: "horror",
  misterio: "mystery",
  romance: "romance",
  "ciencia-ficcion": "science fiction",
  suspense: "thriller",
  poesia: "poetry",
  biografia: "biography",
  infantil: "juvenile fiction",
  ensayo: "essays",
};

/**
 * Semilla cuando no hay ningún filtro: Open Library también exige `q`. Se elige
 * el mismo subject amplio que usaba la rama de Google Books para que el
 * catálogo "sin filtros" siga siendo reconocible.
 */
export const OPEN_LIBRARY_BASE_QUERY = 'subject:"fiction"';

/**
 * ¿Hay que recortar el futuro DESPUÉS de traer, en vez de en la consulta?
 * (E-BOOKS-RANGO)
 *
 * Sí cuando el usuario no ha filtrado por año: ahí la consulta no lleva rango
 * —un rango que abarca todo el corpus hace que Open Library cierre la
 * conexión— y el tope de E-CATALOGO-FUTURO se aplica sobre lo ya recibido.
 * Cuando sí hay filtro de año el rango es selectivo, viaja en la consulta y ya
 * lleva el tope incorporado, así que post-filtrar sería redundante — y además
 * rompería el caso de un año futuro explícito, que se respeta a propósito.
 */
export function openLibraryTrimsFutureAfterFetch(
  year: string | null | undefined
): boolean {
  return openLibraryYearRange(year) === undefined;
}

/** Locale de la app → código de idioma de Open Library (ISO-639-2/B). */
export function openLibraryLanguage(locale?: string | null): "spa" | "eng" {
  return resolveApiLocale(locale) === "en" ? "eng" : "spa";
}

// ── Año → rango real ─────────────────────────────────────────────────────────
// El trigger de año sirve tres formas: un año suelto ("2026"), una década
// ("2000s") y "classic". Con Google Books solo se atendía la primera y las
// otras dos se ignoraban en silencio; aquí las tres son un rango.
// `classic` = 1900-1999, el mismo tramo que usan anime, cómic, juegos y cine.

export function openLibraryYearRange(
  year: string | null | undefined
): { from: number; to: number } | undefined {
  if (!year) return undefined;
  const raw = year.trim();

  if (raw === "classic") return { from: 1900, to: 1999 };

  const decade = /^(\d{4})s$/.exec(raw);
  if (decade) {
    const from = parseInt(decade[1], 10);
    return { from, to: from + 9 };
  }

  const exact = /^(\d{4})$/.exec(raw);
  if (exact) {
    const y = parseInt(exact[1], 10);
    return { from: y, to: y };
  }

  return undefined;
}

// ── Sort → params.sort ───────────────────────────────────────────────────────
// Open Library NO ordena por título. Ofrecer "Título A–Z" era un control que
// no hacía nada: el usuario lo cambiaba y le salían exactamente los mismos
// libros, porque sin `sort` reconocible la API devuelve su orden por
// relevancia. Misma política que ya se aplica en otros tipos ("nunca un
// trigger que mienta", ver `type-filters.ts`): lo que el proveedor no sabe
// hacer no se ofrece.
//
// Este catálogo es además el que alimenta las OPCIONES del desplegable para
// libros, de modo que la lista visible y lo que la API entiende no se puedan
// separar.

export const OPEN_LIBRARY_SORT: Record<string, string> = {
  // Cuánta gente lo tiene en su registro de lectura: la señal de popularidad
  // real que ofrece Open Library.
  popularity: "readinglog",
  rating: "rating",
  release_desc: "new",
  release_asc: "old",
};

export function openLibrarySort(
  sort: string | null | undefined
): string | undefined {
  if (!sort) return undefined;
  // Alias históricos que llegan desde otros catálogos de sort.
  const key =
    sort === "recientes" || sort === "newest" || sort === "recent"
      ? "release_desc"
      : sort === "antiguos" || sort === "oldest"
        ? "release_asc"
        : sort === "valoracion"
          ? "rating"
          : sort === "popularidad"
            ? "popularity"
            : sort;
  return OPEN_LIBRARY_SORT[key];
}

/**
 * Formato → `has_fulltext`.
 *
 * Open Library no distingue "ebook de pago" de "libro físico": lo único que
 * sabe con certeza es si hay texto completo accesible. Así que solo "libre"
 * produce filtro; el resto no acota, que es preferible a fingir una precisión
 * que el proveedor no tiene.
 */
export function openLibraryFulltext(
  formato: string | null | undefined
): string | undefined {
  return formato === "free" ? "true" : undefined;
}

// ── Filtros de entrada ───────────────────────────────────────────────────────

export interface OpenLibraryBookFilters {
  genre?: string[];
  sort?: string | null;
  formato?: string | null;
  idioma?: string | null;
  year?: string | null;
}

export interface OpenLibraryQuery {
  q: string;
  params: Record<string, string>;
}

/** Override explícito del trigger de idioma, si trae un ISO-639-2/B de 3 letras. */
function languageOverride(idioma: string | null | undefined): string | undefined {
  if (!idioma) return undefined;
  const code = idioma.trim().toLowerCase();
  if (/^[a-z]{3}$/.test(code)) return code;
  // Un ISO-639-1 de 2 letras (como lo mandaba la etapa Google Books) se traduce
  // a los dos idiomas que la app soporta; cualquier otro se ignora.
  if (code === "es") return "spa";
  if (code === "en") return "eng";
  return undefined;
}

/**
 * Construye la consulta del catálogo.
 *
 * El idioma SIEMPRE viaja: es lo que garantiza que el título que se lee sea el
 * de la edición en el idioma de la app, y a diferencia de `langRestrict` de
 * Google Books, Open Library lo respeta.
 */
export function buildOpenLibraryQuery(
  filters: OpenLibraryBookFilters = {},
  locale?: string | null
): OpenLibraryQuery {
  const fragments: string[] = [];

  const subjects = (filters.genre ?? [])
    .map((slug) => OPEN_LIBRARY_GENRE[slug])
    .filter((v): v is string => Boolean(v));
  for (const subject of subjects) fragments.push(`subject:"${subject}"`);

  // La base (`subject:"fiction"`) solo entra si el usuario no ha puesto ningún
  // fragmento propio: es lo que da un catálogo con sentido cuando no hay
  // filtros. El tope de fecha se añade DESPUÉS, para no desplazarla nunca.
  const base = fragments.length > 0 ? fragments.join(" ") : OPEN_LIBRARY_BASE_QUERY;

  // E-CATALOGO-FUTURO: el catálogo no muestra libros con año de publicación
  // posterior al actual. Sin tope, `sort=new` ("Más recientes") abre por
  // ediciones anunciadas —y por erratas de catalogación—, igual que pasaba en
  // juegos. Open Library trabaja con grano de AÑO, así que el tope es el año en
  // curso; `libros` no ofrece filtro de estado, así que no hay excepción.
  //
  // Contrapartida asumida: el rango descarta también las obras SIN
  // `first_publish_year`. Es el precio de que "Más recientes" signifique algo
  // — ese orden ya exige el campo — y el catálogo ya venía exigiendo portada.
  // E-BOOKS-RANGO: el rango SOLO viaja si el usuario ha filtrado por año.
  //
  // Un rango que abarca el corpus entero (`[* TO 2026]`, y lo mismo con un
  // suelo numérico) no es un filtro: es pedirle a Open Library que escanee todo
  // su índice. El proveedor no lo rechaza con un 4xx — cierra la conexión, y en
  // el log aparece como `TypeError: terminated · cause=SocketError: other side
  // closed`. Un rango SELECTIVO (`[2010 TO 2019]`) es barato y se sirve sin
  // problema, que es justo por qué la pestaña fallaba sin filtro de año y
  // funcionaba al elegir una década.
  //
  // Así que cuando no hay filtro de año el tope de futuro (E-CATALOGO-FUTURO)
  // se aplica como POST-FILTRO sobre lo ya recibido (`dropFutureYears`, en la
  // rama `book` de `fetchDiscoverData`), igual que en manga. Es un recorte
  // marginal y la ventana de 60 lo absorbe.
  const range = openLibraryYearRange(filters.year);
  const currentYear = todayYear();
  // Rango que EMPIEZA en el futuro: se respeta (recortarlo daría una ventana
  // invertida = catálogo vacío). El resto se acota al año en curso.
  const to = range
    ? range.from > currentYear
      ? range.to
      : Math.min(range.to, currentYear)
    : undefined;

  const q = range
    ? `${base} first_publish_year:[${range.from} TO ${to}]`
    : base;

  const params: Record<string, string> = {
    language: languageOverride(filters.idioma) ?? openLibraryLanguage(locale),
  };
  const sort = openLibrarySort(filters.sort);
  if (sort) params.sort = sort;
  const fulltext = openLibraryFulltext(filters.formato);
  if (fulltext) params.has_fulltext = fulltext;

  return { q, params };
}
