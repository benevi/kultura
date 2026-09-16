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
//
// La landing NUNCA depende de esto para ser usable: sin muestra, los
// componentes caen a su versión de gradiente (ver `HeroCollage`).
// ============================================================

import * as React from "react";
import { unstable_cache } from "next/cache";
import { FAMILIES } from "@/lib/api/aggregate";
import { fetchDiscoverData } from "@/lib/api/discover";
import { createLogger } from "@/lib/logger";
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
 * Cuántas portadas pide la landing: collage del hero (3) y tira de móvil (4),
 * que arrancan las dos en el mismo punto de la lista. Las tarjetas de features
 * ya no llevan miniaturas, así que no consumen muestra.
 */
export const LANDING_SHOWCASE_SIZE = 4;

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
 * gate de portada de las recomendaciones IA).
 */
export function pickShowcase(
  items: MediaItem[],
  size = LANDING_SHOWCASE_SIZE
): ShowcaseItem[] {
  const withPoster = items.filter(
    (item): item is MediaItem & { poster: string } =>
      typeof item.poster === "string" && item.poster.length > 0
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
      withTimeout(
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

const cachedShowcase = unstable_cache(loadShowcase, ["landing-showcase"], {
  revalidate: SHOWCASE_TTL_SECONDS,
  tags: ["landing-showcase"],
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
