// ============================================================
// KULTURA — Portadas reales para la landing (E-LANDING-SHOWCASE)
//
// La landing enseñaba su propuesta con bloques de gradiente: honestos como
// primitivo F0, pero no cuentan qué hay dentro. Aquí se resuelve una muestra
// de portadas REALES del catálogo (película, serie, anime, libro, manga,
// juego, cómic) para pintarlas en el hero y en las tarjetas de features.
//
// Decisiones (y por qué):
//   - Fan-out por familia con `fetchDiscoverData` (la misma rama nativa que usa
//     Descubrir: builders, normalizador, filtro NSFW), y se usa LO QUE LLEGUE.
//     El primer intento pedía el agregado entero con un `Promise.race` de 2,5 s:
//     todo-o-nada, con el proveedor MÁS LENTO decidiendo por los siete — bastaba
//     que uno tardase para quedarse sin una sola portada, que es justo lo que
//     pasó en preview. Ahora cada familia tiene su propio plazo y las rápidas
//     llenan la muestra aunque las lentas no lleguen.
//   - `/[locale]` se renderiza on-demand (ƒ en el build), así que sin caché
//     cada visita a la landing dispararía ese fan-out. `unstable_cache` guarda
//     el RESULTADO (una lista de portadas, no de items completos) un día, y
//     `cache()` de React deduplica las varias llamadas de un mismo render.
//   - Nunca se cachea una muestra vacía: si la carga se queda corta se lanza,
//     y `unstable_cache` no guarda rechazos — así un hipo de un proveedor no
//     congela la landing sin imágenes durante 24 h.
//   - El plazo por familia es HOLGADO porque la espera NO está en el camino
//     crítico: la landing pinta su versión de gradientes y las portadas entran
//     por `<Suspense>` cuando estén (ver `ShowcaseSlots`).
//   - Videojuegos (DIS-4): RAWG no tiene carátula vertical, su `background_image`
//     es una captura apaisada que recortada a 2:3 no se entiende. Los juegos
//     del muro salen de una LISTA BLANCA revisada a mano (`CURATED_GAMES`) con
//     la carátula vertical de Steam (`library_600x900`), y cualquier portada de
//     RAWG que se cuele se descarta. De paso, la landing ya no gasta cupo de RAWG.
//
// La landing NUNCA depende de esto para ser usable: sin muestra, los
// componentes caen a su versión de gradiente (ver `HeroCollage`).
// ============================================================

import * as React from "react";
import { unstable_cache } from "next/cache";
import { FAMILIES } from "@/lib/api/aggregate";
import { fetchDiscoverData } from "@/lib/api/discover";
import { createLogger } from "@/lib/logger";
import { SHOWCASE_CACHE_TAG } from "@/lib/best/cache-tags";
import type { MediaItem, MediaType } from "@/types/media";

const log = createLogger("landing-showcase");

/** Portada lista para pintar: solo lo que la landing necesita. */
export interface ShowcaseItem {
  id: string;
  title: string;
  type: MediaType;
  poster: string;
}

/**
 * Cuántas portadas pide la landing. La escena inmersiva del hero
 * (E-LANDING-INMERSIVA) monta un túnel de tres vueltas de siete portadas, así
 * que pide 21; el hero estático de respaldo (collage de 3 y tira de móvil de 4)
 * toma las primeras de la MISMA lista, que ya arranca con un tipo de cada.
 */
export const LANDING_SHOWCASE_SIZE = 21;

/**
 * Juegos del muro (DIS-4): icónicos y recientes, con su id de RAWG (la ficha
 * enlaza a `/media/game/{rawg}`) y su `appid` de Steam (carátula vertical).
 * Ids comprobados a mano el 2026-10-22 contra la búsqueda de la app y la API
 * de Steam; todos con carátula 600×900. Sin títulos para adultos.
 */
export const CURATED_GAMES: ReadonlyArray<{ rawg: number; steam: number; title: string }> = [
  { rawg: 983210, steam: 1903340, title: "Clair Obscur: Expedition 33" },
  { rawg: 292844, steam: 1030300, title: "Hollow Knight: Silksong" },
  { rawg: 994603, steam: 2001120, title: "Split Fiction" },
  { rawg: 891238, steam: 1145350, title: "Hades II" },
  { rawg: 324997, steam: 1086940, title: "Baldur's Gate 3" },
  { rawg: 326243, steam: 1245620, title: "Elden Ring" },
  { rawg: 3328, steam: 292030, title: "The Witcher 3: Wild Hunt" },
  { rawg: 28, steam: 1174180, title: "Red Dead Redemption 2" },
  { rawg: 41494, steam: 1091500, title: "Cyberpunk 2077" },
  { rawg: 274755, steam: 1145360, title: "Hades" },
  { rawg: 9767, steam: 367520, title: "Hollow Knight" },
  { rawg: 262382, steam: 632470, title: "Disco Elysium" },
  { rawg: 654, steam: 413150, title: "Stardew Valley" },
  { rawg: 22121, steam: 504230, title: "Celeste" },
  { rawg: 4200, steam: 620, title: "Portal 2" },
  { rawg: 58175, steam: 1593500, title: "God of War" },
  { rawg: 50734, steam: 814380, title: "Sekiro: Shadows Die Twice" },
];

/** Juegos de la lista blanca que entran cada día en la muestra. */
const CURATED_PER_DAY = 6;

/** Carátula vertical de Steam (600×900; el host está en `images.remotePatterns`). */
export function steamCover(appid: number): string {
  return `https://cdn.steamstatic.com/steam/apps/${appid}/library_600x900_2x.jpg`;
}

/**
 * Portada apaisada (captura de RAWG): no sirve como carátula 2:3. La usan el
 * muro y los abanicos de rankings de la landing para no recortar capturas.
 */
export function isLandscapePoster(poster: string | null | undefined): boolean {
  if (!poster) return false;
  try {
    return new URL(poster).hostname === "media.rawg.io";
  } catch {
    return false;
  }
}

/**
 * Los juegos del día, como items de catálogo. Rotan por día (la muestra se
 * cachea un día) para que el muro no sea siempre el mismo.
 */
export function curatedGames(today: Date = new Date(), size = CURATED_PER_DAY): MediaItem[] {
  const day = Math.floor(today.getTime() / 86_400_000);
  const n = CURATED_GAMES.length;
  return Array.from({ length: Math.min(size, n) }, (_, i) => {
    const g = CURATED_GAMES[(day + i) % n];
    return {
      id: `game_${g.rawg}`,
      externalId: String(g.rawg),
      type: "game" as const,
      title: g.title,
      poster: steamCover(g.steam),
    };
  });
}

/** Mínimo para que merezca la pena pintar portadas en vez de gradientes. */
export const LANDING_SHOWCASE_MIN = 4;

/** Prioridad de familia (ver SHOWCASE_FAMILIES). */
const FAMILY_ORDER = [
  "movie",
  "tv",
  "anime",
  "book",
  "game",
  "manga",
  "comic",
] as const;

/** Un día: el catálogo popular no cambia a ritmo de visita. */
const SHOWCASE_TTL_SECONDS = 60 * 60 * 24;

/**
 * Plazo POR FAMILIA. Holgado a propósito: la muestra se resuelve fuera del
 * camino crítico (`<Suspense>`), así que esperar a un proveedor lento no
 * retrasa el primer pintado — y sí mejora las probabilidades de tener
 * portadas. Una familia que se pase de plazo simplemente no aporta.
 */
const FAMILY_TIMEOUT_MS = 6000;

/**
 * Orden de petición: primero las familias que responden más rápido y con
 * portada casi siempre (TMDB), al final las lentas (ComicVine). El
 * round-robin de `interleave` respeta este orden, así que la muestra empieza
 * variada aunque la cola no llegue.
 */
const SHOWCASE_FAMILIES = [...FAMILIES].sort(
  (a, b) => FAMILY_ORDER.indexOf(a) - FAMILY_ORDER.indexOf(b)
);

/**
 * Ordena la muestra para que las primeras portadas sean de tipos DISTINTOS
 * (una por familia) y el resto rellene detrás. El agregado ya alterna por
 * familia, pero una familia caída correría el turno de las demás y el hero
 * acabaría con tres películas; esto lo garantiza explícitamente.
 *
 * Descarta lo que no tenga portada real: el objetivo del bloque es justo esa
 * imagen, y una card sin ella desluce la fila entera (mismo criterio que el
 * gate de portada de las recomendaciones IA). Tampoco entran capturas
 * apaisadas (DIS-4).
 */
export function pickShowcase(
  items: MediaItem[],
  size = LANDING_SHOWCASE_SIZE
): ShowcaseItem[] {
  const withPoster = items.filter(
    (item): item is MediaItem & { poster: string } =>
      typeof item.poster === "string" && item.poster.length > 0 && !isLandscapePoster(item.poster)
  );

  const firstOfType: (MediaItem & { poster: string })[] = [];
  const rest: (MediaItem & { poster: string })[] = [];
  const seen = new Set<MediaType>();
  for (const item of withPoster) {
    if (seen.has(item.type)) rest.push(item);
    else {
      seen.add(item.type);
      firstOfType.push(item);
    }
  }

  return [...firstOfType, ...rest].slice(0, size).map((item) => ({
    id: item.id,
    title: item.title,
    type: item.type,
    poster: item.poster,
  }));
}

/**
 * Vuelve a MediaItem una portada de la muestra (su `id` es "{type}_{externalId}"),
 * lo justo para pintarla con `MediaCard` y enlazar a la ficha.
 */
export function showcaseToMediaItem(item: ShowcaseItem): MediaItem {
  return {
    id: item.id,
    externalId: item.id.slice(item.type.length + 1),
    type: item.type,
    title: item.title,
    poster: item.poster,
  };
}

/**
 * Round-robin entre listas: 1º de cada una, luego 2º… Preserva el orden nativo
 * de cada familia y alterna tipos (mismo criterio que el interleave del
 * agregado, reimplementado aquí porque allí es privado y esto son 8 líneas).
 */
export function interleave<T>(lists: T[][]): T[] {
  const out: T[] = [];
  const longest = lists.reduce((m, l) => Math.max(m, l.length), 0);
  for (let i = 0; i < longest; i++) {
    for (const list of lists) if (i < list.length) out.push(list[i]);
  }
  return out;
}

/** Resuelve a `fallback` si `promise` se pasa de `ms` (no deja cuelgues). */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}

/**
 * Carga la muestra pidiendo cada familia por separado y quedándose con lo que
 * llegue a tiempo. LANZA si no alcanza el mínimo, a propósito: así el resultado
 * pobre no entra en la caché de un día (`unstable_cache` no guarda rechazos).
 */
async function loadShowcase(locale: string): Promise<ShowcaseItem[]> {
  const lists = await Promise.all(
    SHOWCASE_FAMILIES.map((type) =>
      type === "game"
        ? Promise.resolve(curatedGames())
        : withTimeout(
            fetchDiscoverData(type, 1, {}, locale).then((res) => res.items),
            FAMILY_TIMEOUT_MS,
            []
          )
    )
  );

  const picked = pickShowcase(interleave(lists));

  // Diagnóstico en el MENSAJE, no en el contexto: el visor de Vercel colapsa
  // `context:{…}` y en su día nos dejó a ciegas con el fallo de libros.
  const answered = SHOWCASE_FAMILIES.filter((_, i) => lists[i].length > 0);
  if (picked.length < LANDING_SHOWCASE_MIN) {
    throw new Error(
      `showcase incompleto · ${picked.length} portadas · familias con items: ${
        answered.join(",") || "ninguna"
      }`
    );
  }
  log.info(
    `showcase listo · ${picked.length} portadas · familias: ${answered.join(",")}`
  );
  return picked;
}

// La clave lleva versión: una entrada antigua de la caché (un día) serviría la
// muestra anterior (v2: con capturas de RAWG). La etiqueta es la que acepta
// `POST /api/revalidate` para vaciarla sin desplegar.
const cachedShowcase = unstable_cache(loadShowcase, ["landing-showcase-v3"], {
  revalidate: SHOWCASE_TTL_SECONDS,
  tags: [SHOWCASE_CACHE_TAG],
});

/**
 * Memoización POR RENDER. `cache()` de React solo existe en el build de
 * servidor de React: en el entorno de test (build de cliente) es `undefined`,
 * así que se degrada a la identidad — sin dedupe, que en un test da igual.
 */
const perRender = <T extends (...args: never[]) => unknown>(fn: T): T =>
  (React as { cache?: (f: T) => T }).cache?.(fn) ?? fn;

/**
 * Muestra de portadas para la landing. Nunca lanza: devuelve `[]` cuando no hay
 * datos y el llamante pinta la versión de gradientes.
 */
export const getLandingShowcase = perRender(
  async (locale: string): Promise<ShowcaseItem[]> => {
    try {
      return await cachedShowcase(locale);
    } catch (e) {
      log.warn(
        `sin portadas reales para la landing · ${e instanceof Error ? e.message : String(e)}`
      );
      return [];
    }
  }
);
