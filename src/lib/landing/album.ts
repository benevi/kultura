// ============================================================
// KULTURA — El álbum abierto de la portada (piezas puras)
//
// La portada es el álbum abierto por el lomo: a la izquierda «Lo mejor de
// {año}» con los huecos ya llenos por portadas REALES de los rankings; a la
// derecha, huecos numerados con el título impreso («te faltan»), que el sobre
// llena al bajar la primera pantalla (escena three.js, `sobre-scene.ts`).
//
// Aquí solo hay datos y cálculo (sin React ni three): qué portadas entran en
// cada página, si el dispositivo puede con la escena y cómo se mueve cada
// cromo (muelle amortiguado, rigidez 170 y amortiguación 26). Lo usan el
// servidor, el componente de cliente y los tests.
// ============================================================

import type { MediaType } from "@/types/media";

/** Un cromo de la portada: lo justo para pintarlo y enlazar a su ficha. */
export interface AlbumCromo {
  id: string;
  title: string;
  type: MediaType;
  poster: string;
  /** Ruta de la ficha sin idioma (`/media/movie/123`). */
  path: string;
  /** Nota del proveedor sobre 10, si la hay (10 = brillo). */
  rating?: number;
}

/** Huecos por página del álbum de la portada. */
export const ALBUM_PAGE_SIZE = 8;

/**
 * Captura apaisada (RAWG): no es una carátula 2:3 y recortada no se entiende
 * (DIS-4). Ningún cromo de la portada sale sin carátula vertical.
 */
export function isPortraitPoster(poster: string | null | undefined): poster is string {
  if (!poster) return false;
  try {
    return new URL(poster).hostname !== "media.rawg.io";
  } catch {
    return false;
  }
}

/** Ruta de la ficha pública de un título (`{tipo}_{id}` → `/media/{tipo}/{id}`). */
export function cromoPath(item: { id: string; type: string; externalId?: string }): string {
  const prefix = `${item.type}_`;
  const external = item.externalId ?? (item.id.startsWith(prefix) ? item.id.slice(prefix.length) : item.id);
  return `/media/${item.type}/${encodeURIComponent(external)}`;
}

interface RankedLike {
  id: string;
  externalId?: string;
  type: MediaType;
  title: string;
  poster?: string | null;
  rating?: number;
}

/**
 * Página izquierda: los primeros de cada ranking del año, alternando formato
 * (1º de cine, 1º de series, 1º de anime, 2º de cine…). Solo con carátula
 * vertical (los juegos de RAWG no la tienen y se quedan fuera, nunca un
 * cromo sin portada).
 */
export function pickBestPage(lists: RankedLike[][], size = ALBUM_PAGE_SIZE): AlbumCromo[] {
  const usable = lists.map((list) => list.filter((it) => isPortraitPoster(it.poster)));
  const out: AlbumCromo[] = [];
  const seen = new Set<string>();
  const longest = usable.reduce((m, l) => Math.max(m, l.length), 0);
  for (let i = 0; i < longest && out.length < size; i++) {
    for (const list of usable) {
      const it = list[i];
      if (!it || seen.has(it.id) || out.length >= size) continue;
      seen.add(it.id);
      out.push({
        id: it.id,
        title: it.title,
        type: it.type,
        poster: it.poster as string,
        path: cromoPath(it),
        rating: typeof it.rating === "number" ? it.rating : undefined,
      });
    }
  }
  return out;
}

/**
 * Página derecha: títulos del catálogo (la muestra de portadas, siete
 * formatos) que no estén ya en la izquierda. Primero uno de cada formato.
 */
export function pickMissingPage(
  items: RankedLike[],
  exclude: Iterable<string> = [],
  size = ALBUM_PAGE_SIZE
): AlbumCromo[] {
  const skip = new Set(exclude);
  const usable = items.filter((it) => isPortraitPoster(it.poster) && !skip.has(it.id));
  const first: RankedLike[] = [];
  const rest: RankedLike[] = [];
  const types = new Set<MediaType>();
  for (const it of usable) {
    if (types.has(it.type)) rest.push(it);
    else {
      types.add(it.type);
      first.push(it);
    }
  }
  return [...first, ...rest].slice(0, size).map((it) => ({
    id: it.id,
    title: it.title,
    type: it.type,
    poster: it.poster as string,
    path: cromoPath(it),
    rating: typeof it.rating === "number" ? it.rating : undefined,
  }));
}

/**
 * Textura de un cromo de la escena: mismo origen (el optimizador de Next),
 * porque WebGL necesita CORS, y un único ancho acotado.
 */
export const TEXTURE_WIDTH = 384;
export function textureUrl(poster: string): string {
  return `/_next/image?url=${encodeURIComponent(poster)}&w=${TEXTURE_WIDTH}&q=70`;
}

// ── ¿Escena 3D, una sola pasada o álbum quieto? ─────────────────────────────

/**
 * - `scroll`: escritorio con puntero fino: los cromos salen del sobre y van a
 *   sus huecos al bajar la primera pantalla (el scroll marca el destino; el
 *   muelle, el camino).
 * - `once`: móvil o puntero táctil: menos cromos, sin atar al scroll, una sola
 *   vez cuando la página entra en pantalla.
 * - `static`: movimiento reducido, sin WebGL 2, ahorro de datos o equipo
 *   justo: los huecos se llenan sin escena (al instante con movimiento
 *   reducido; si no, un pegado escalonado).
 */
export type BurstMode = "scroll" | "once" | "static";

export interface BurstEnv {
  reducedMotion: boolean;
  webgl2: boolean;
  saveData?: boolean;
  /** `navigator.deviceMemory` (GB; solo Chromium). Sin dato, no cuenta. */
  deviceMemory?: number;
  width: number;
  /** `(pointer: coarse)`: pantalla táctil como puntero principal. */
  coarse: boolean;
}

/** Ancho desde el que la escena va ligada al scroll (pliego de dos páginas). */
export const BURST_SCROLL_MIN_WIDTH = 768;

export function burstMode(env: BurstEnv): BurstMode {
  if (env.reducedMotion || !env.webgl2 || env.saveData) return "static";
  if (env.deviceMemory !== undefined && env.deviceMemory < 4) return "static";
  if (env.coarse || env.width < BURST_SCROLL_MIN_WIDTH) return "once";
  return "scroll";
}

/** Cromos que salen del sobre: seis en escritorio, cuatro en el móvil. */
export function burstCount(mode: BurstMode, wide: boolean, available: number): number {
  const want = mode === "once" || !wide ? 4 : 6;
  return Math.max(0, Math.min(want, available));
}

// ── Movimiento: muelle amortiguado y reparto del scroll ─────────────────────

/** Rigidez y amortiguación del muelle (masa 1): casi crítico, sin rebote largo. */
export const SPRING_STIFFNESS = 170;
export const SPRING_DAMPING = 26;

export interface SpringState {
  x: number;
  v: number;
}

/**
 * Un paso del muelle hacia `target` (Euler semimplícito en subpasos de
 * ≤ 1/120 s, estable aunque un fotograma tarde). Devuelve el estado nuevo.
 */
export function springStep(state: SpringState, target: number, dt: number): SpringState {
  let { x, v } = state;
  let left = Math.min(Math.max(dt, 0), 0.1);
  while (left > 1e-6) {
    const h = Math.min(left, 1 / 120);
    const a = -SPRING_STIFFNESS * (x - target) - SPRING_DAMPING * v;
    v += a * h;
    x += v * h;
    left -= h;
  }
  return { x, v };
}

/**
 * Avance a partir del cual un cromo se da por posado (la pieza 3D se retira y
 * el hueco pinta su cromo en HTML): el muelle llega aquí en ~0,52 s.
 */
export const LAND_AT = 0.99;

/** ¿Ha llegado el muelle? (posición y velocidad casi en el destino). */
export function springSettled(state: SpringState, target: number, eps = 1e-3): boolean {
  return Math.abs(state.x - target) < eps && Math.abs(state.v) < eps * 10;
}

/** Desfase entre cromos al llenar una página (40 ms en la pasada única). */
export const BURST_STAGGER_MS = 40;

/**
 * Parte del recorrido que toca al cromo `i` de `n` para un avance global `p`
 * (0-1): salen escalonados y todos llegan antes de `p = 1`.
 */
export function cromoProgress(p: number, i: number, n: number, overlap = 0.55): number {
  if (n <= 1) return clamp01(p);
  const span = 1 / (1 + (n - 1) * (1 - overlap));
  const start = i * span * (1 - overlap);
  return clamp01((p - start) / span);
}

/**
 * Avance del scroll sobre la primera pantalla: 0 arriba del todo, 1 cuando se
 * ha bajado `range` píxeles desde `start`.
 */
export function scrollProgress(scrollY: number, start: number, range: number): number {
  if (range <= 0) return scrollY > start ? 1 : 0;
  return clamp01((scrollY - start) / range);
}

export function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

/** Curva de salida (para el camino del cromo, no para el tiempo). */
export function easeOutCubic(t: number): number {
  const u = 1 - clamp01(t);
  return 1 - u * u * u;
}
