// ============================================================
// KULTURA — Steam Store API (E-GAMES-STEAM)
// Enriquece la FICHA de un juego ya identificado: precio, capturas, idiomas
// soportados y nota de Metacritic. No requiere API key.
//
// Alcance deliberado (decisión de producto, no reabrir): Steam **no tiene**
// endpoint público de búsqueda/catálogo paginado, solo detalle por `appid`, así
// que Descubrir, los listados y la paginación siguen siendo de RAWG
// (`src/lib/api/rawg.ts`). Steam entra SOLO en `/media/game/{id}`.
//
// Endpoints usados (no oficiales pero estables y públicos):
//   - store.steampowered.com/api/appdetails?appids={id}&l={idioma}&cc={país}
//   - store.steampowered.com/api/storesearch/?term={texto}&cc={país}&l={idioma}
//
// CONTRATO DE DEGRADACIÓN: nada de este módulo debe poder romper la ficha. Todo
// devuelve `null` ante cualquier problema (juego no está en Steam, `appid` no
// resoluble con confianza, red caída, shape inesperado, `success: false`), y la
// ficha se pinta igual sin la sección de Steam. Por eso no se lanza NUNCA hacia
// fuera y todos los campos del shape son opcionales.
// ============================================================

import type { RawgGame } from "@/lib/api/rawg";
import { resolveApiLocale } from "@/lib/api/locale";

/** Locale → parámetro `l` de Steam (idioma de textos y de `supported_languages`). */
export function steamLanguage(locale?: string | null): "spanish" | "english" {
  return resolveApiLocale(locale) === "en" ? "english" : "spanish";
}

/** Locale → parámetro `cc` de Steam (país de la moneda y del precio). */
export function steamCountry(locale?: string | null): "ES" | "US" {
  return resolveApiLocale(locale) === "en" ? "US" : "ES";
}

// ── Shape que consume la UI ───────────────────────────────────────────────────

export interface SteamScreenshot {
  thumb: string;
  full: string;
}

export interface SteamInfo {
  appId: number;
  storeUrl: string;
  isFree: boolean;
  /** Precio ya formateado por Steam en la moneda del país (p.ej. "19,99€"). */
  price?: string;
  /** Precio original formateado, solo si hay descuento activo. */
  priceOriginal?: string;
  discountPercent?: number;
  /** Idiomas soportados, ya limpios de marcas HTML y de asteriscos de doblaje. */
  supportedLanguages?: string[];
  screenshots?: SteamScreenshot[];
  metacritic?: number;
}

// ── Shape crudo de la API (todo opcional: shape no versionado) ────────────────

interface SteamAppDetailsData {
  type?: string;
  name?: string;
  steam_appid?: number;
  is_free?: boolean;
  supported_languages?: string;
  price_overview?: {
    final_formatted?: string;
    initial_formatted?: string;
    discount_percent?: number;
  };
  screenshots?: { id?: number; path_thumbnail?: string; path_full?: string }[];
  metacritic?: { score?: number };
}

interface SteamAppDetailsResponse {
  [appId: string]: { success?: boolean; data?: SteamAppDetailsData } | undefined;
}

interface SteamStoreSearchResponse {
  total?: number;
  items?: { id?: number; name?: string; type?: string }[];
}

const STEAM_STORE_BASE = "https://store.steampowered.com";

/** URL pública de la ficha de tienda (la que se enlaza desde la UI). */
export function steamStoreUrl(appId: number): string {
  return `${STEAM_STORE_BASE}/app/${appId}/`;
}

/**
 * `supported_languages` viene como HTML: `"English<strong>*</strong>, Spanish -
 * Spain, Japanese*<br><strong>*</strong>languages with full audio support"`.
 * Se quitan las etiquetas, la nota final de doblaje y los asteriscos, y se
 * parte por comas. Devuelve `undefined` si no queda nada útil.
 */
export function parseSupportedLanguages(
  raw: string | undefined
): string[] | undefined {
  if (!raw) return undefined;
  const withoutNote = raw.split(/<br\s*\/?>/i)[0];
  const plain = withoutNote.replace(/<[^>]*>/g, "");
  const langs = plain
    .split(",")
    .map((l) => l.replace(/\*/g, "").trim())
    .filter((l) => l.length > 0);
  return langs.length > 0 ? langs : undefined;
}

/**
 * Extrae el `appid` de una URL de tienda de Steam
 * (`https://store.steampowered.com/app/1145360/Hades/`). `null` si la URL no es
 * de Steam o no lleva id: preferimos no enseñar datos de Steam a enseñar los de
 * otro juego.
 */
export function steamAppIdFromUrl(url: string | undefined): number | null {
  if (!url) return null;
  const m = /store\.steampowered\.com\/app\/(\d+)/i.exec(url);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * `appid` desde el detalle de RAWG. RAWG expone `stores[]` con `store.slug` y
 * la `url` de la ficha en cada tienda; cuando la de Steam está presente es la
 * vía fiable (es un enlace curado, no una coincidencia por nombre).
 */
export function steamAppIdFromRawgGame(game: RawgGame): number | null {
  for (const entry of game.stores ?? []) {
    const isSteam =
      entry.store?.slug === "steam" ||
      entry.store?.domain === "store.steampowered.com" ||
      entry.store?.id === 1;
    if (!isSteam) continue;
    const fromUrl = steamAppIdFromUrl(entry.url);
    if (fromUrl) return fromUrl;
  }
  // Algunas respuestas de RAWG traen la URL de Steam sin metadatos de tienda.
  for (const entry of game.stores ?? []) {
    const fromUrl = steamAppIdFromUrl(entry.url);
    if (fromUrl) return fromUrl;
  }
  return null;
}

/**
 * Best-effort por nombre vía `storesearch` cuando RAWG no da el enlace de
 * Steam. Solo se acepta si el nombre coincide de forma NORMALIZADA (sin
 * acentos, signos ni mayúsculas): un "parecido" no basta — mostrar el precio
 * de otro juego sería peor que no mostrar nada.
 */
export async function searchSteamAppId(
  name: string,
  locale?: string | null
): Promise<number | null> {
  if (!name.trim()) return null;
  const url = new URL(`${STEAM_STORE_BASE}/api/storesearch/`);
  url.searchParams.set("term", name);
  url.searchParams.set("cc", steamCountry(locale));
  url.searchParams.set("l", steamLanguage(locale));

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const json = (await res.json()) as SteamStoreSearchResponse;

  const target = normalizeGameName(name);
  for (const candidate of json.items ?? []) {
    if (!candidate.id || !candidate.name) continue;
    if (normalizeGameName(candidate.name) === target) return candidate.id;
  }
  return null;
}

/** Normaliza un nombre para comparar: sin acentos, sin signos, minúsculas. */
function normalizeGameName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // marcas diacríticas
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/** Detalle de tienda por `appid`. `null` si Steam no lo sirve. */
export async function getSteamAppDetails(
  appId: number,
  locale?: string | null
): Promise<SteamAppDetailsData | null> {
  const url = new URL(`${STEAM_STORE_BASE}/api/appdetails`);
  url.searchParams.set("appids", String(appId));
  url.searchParams.set("l", steamLanguage(locale));
  url.searchParams.set("cc", steamCountry(locale));

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const json = (await res.json()) as SteamAppDetailsResponse;
  const entry = json?.[String(appId)];
  // `success: false` es la respuesta normal para un appid que no existe o no
  // está disponible en ese país — no es un error de red.
  if (!entry?.success || !entry.data) return null;
  return entry.data;
}

/** Detalle crudo → shape de UI. */
export function toSteamInfo(
  appId: number,
  data: SteamAppDetailsData
): SteamInfo {
  const discount = data.price_overview?.discount_percent;
  return {
    appId,
    storeUrl: steamStoreUrl(appId),
    isFree: Boolean(data.is_free),
    price: data.price_overview?.final_formatted,
    priceOriginal:
      discount && discount > 0
        ? data.price_overview?.initial_formatted
        : undefined,
    discountPercent: discount && discount > 0 ? discount : undefined,
    supportedLanguages: parseSupportedLanguages(data.supported_languages),
    screenshots: (data.screenshots ?? [])
      .filter((s) => s.path_thumbnail && s.path_full)
      .slice(0, 4)
      .map((s) => ({
        thumb: s.path_thumbnail as string,
        full: s.path_full as string,
      })),
    metacritic:
      typeof data.metacritic?.score === "number"
        ? data.metacritic.score
        : undefined,
  };
}

/**
 * Punto de entrada único: dado el detalle de RAWG, devuelve los datos de Steam
 * o `null`. **Nunca lanza** — cualquier fallo se registra y la ficha se pinta
 * sin la sección (ver CONTRATO DE DEGRADACIÓN en la cabecera).
 */
export async function getSteamInfoForGame(
  game: RawgGame,
  locale?: string | null
): Promise<SteamInfo | null> {
  try {
    const appId =
      steamAppIdFromRawgGame(game) ??
      (await searchSteamAppId(game.name, locale));
    if (!appId) return null;

    const data = await getSteamAppDetails(appId, locale);
    if (!data) return null;
    // `type` distingue juego de DLC/demo/paquete: un DLC tiene su propia ficha
    // y su precio no representa al juego.
    if (data.type && data.type !== "game") return null;

    return toSteamInfo(appId, data);
  } catch (e) {
    console.error(`[steam] enriquecimiento omitido para "${game.name}":`, e);
    return null;
  }
}
