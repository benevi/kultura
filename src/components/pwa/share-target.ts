// ============================================================
// KULTURA — Qué buscar cuando se comparte algo CON la app (MOV-9)
//
// El manifest declara `share_target` → `/{locale}/share?title=&text=&url=`.
// Compartir desde TMDB, IMDb, Letterboxd, MyAnimeList, Goodreads, Steam…
// manda una URL y, según la app, un título o un texto con la URL dentro. De
// eso se saca el título más limpio posible para abrir la búsqueda.
// Lógica pura: la usa el route handler y la prueban los tests.
// ============================================================

export interface SharedData {
  title?: string | null;
  text?: string | null;
  url?: string | null;
}

export const MAX_QUERY_LENGTH = 100;

const URL_RE = /https?:\/\/[^\s<>"]+/gi;

/**
 * Páginas de ficha conocidas: el título va en la ruta (`/movie/438631-dune`,
 * `/film/dune-part-two/`, `/anime/5114/Fullmetal_Alchemist_Brotherhood`…).
 * El grupo 1 de `path` es el trozo con el nombre.
 */
const PROVIDERS: Array<{ host: RegExp; path: RegExp }> = [
  { host: /(^|\.)themoviedb\.org$/, path: /^\/(?:movie|tv)\/\d+-([^/]+)/ },
  { host: /(^|\.)letterboxd\.com$/, path: /^\/film\/([^/]+)/ },
  { host: /(^|\.)myanimelist\.net$/, path: /^\/(?:anime|manga)\/\d+\/([^/?#]+)/ },
  { host: /(^|\.)anilist\.co$/, path: /^\/(?:anime|manga)\/\d+\/([^/?#]+)/ },
  { host: /(^|\.)goodreads\.com$/, path: /^\/book\/show\/\d+[-.]([^/?#]+)/ },
  { host: /(^|\.)rawg\.io$/, path: /^\/games\/([^/?#]+)/ },
  { host: /(^|\.)store\.steampowered\.com$/, path: /^\/app\/\d+\/([^/?#]+)/ },
];

/**
 * Sufijo de sitio en el `<title>` de la página compartida: tras `|` o `·`
 * siempre (casi ningún título los lleva); tras un guion, solo si lo que sigue
 * es un sitio conocido ("Spider-Man - Cruzando el Multiverso" se queda entero).
 */
const PIPE_SUFFIX = /\s+[|·•]\s+[^|·•]*$/;
const DASH_SITE_SUFFIX =
  /\s+[–—-]\s+(?:the movie database|tmdb|imdb|letterboxd|myanimelist|anilist|goodreads|steam|rawg|wikipedia|filmaffinity|netflix|prime video|disney\+|hbo max|filmin|youtube|amazon(?:\.\w+)?|google play|app store|apple tv\+?)(?:[^\p{L}\p{N}][^]*)?$/iu;

function tidy(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function fromSlug(slug: string): string {
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    // Escapes rotos: se usa tal cual.
  }
  return tidy(decoded.replace(/[-_+]+/g, " "));
}

function parseUrl(raw: string | null | undefined): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** Título que va en la ruta de una ficha conocida (o `null`). */
export function titleFromProviderUrl(url: URL): string | null {
  for (const provider of PROVIDERS) {
    if (!provider.host.test(url.hostname)) continue;
    const match = url.pathname.match(provider.path);
    if (match?.[1]) {
      const title = fromSlug(match[1]);
      if (/[\p{L}\p{N}]/u.test(title)) return title;
    }
  }
  return null;
}

/** "Dune: Parte dos (2024) | The Movie Database (TMDB)" → "Dune: Parte dos (2024)". */
export function cleanTitle(raw: string | null | undefined): string {
  let title = tidy((raw ?? "").replace(URL_RE, " "));
  for (const suffix of [PIPE_SUFFIX, DASH_SITE_SUFFIX]) {
    const stripped = tidy(title.replace(suffix, ""));
    if (stripped.length >= 2) title = stripped;
  }
  return title;
}

/** Texto de búsqueda (vacío si no hay nada aprovechable). */
export function shareQuery({ title, text, url }: SharedData): string {
  const urls = [url, ...((text ?? "").match(URL_RE) ?? [])].map(parseUrl).filter((u): u is URL => u !== null);
  let query = "";
  for (const candidate of urls) {
    const fromProvider = titleFromProviderUrl(candidate);
    if (fromProvider) {
      query = fromProvider;
      break;
    }
  }
  if (!query) query = cleanTitle(title);
  if (!query) query = cleanTitle(text);
  return Array.from(query).slice(0, MAX_QUERY_LENGTH).join("").trim();
}
