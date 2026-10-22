// ============================================================
// KULTURA — Constantes y helpers del hero de la landing (D-11)
//
// Viven FUERA de `ImmersiveBackdrop.tsx` porque ese archivo es "use client": un
// valor exportado desde ahí llega a un Server Component como referencia de
// cliente, no como el array de verdad (y `page.tsx` lo recorre).
//
// D-11 (hero único): el titular, el subtítulo y los dos botones se pintan con
// el HTML, desde el primer fotograma, y no dependen de la intro. La galería
// WebGL queda de FONDO: no tapa nada, se puede pausar (WCAG 2.2.2) y no se
// carga cuando el sistema pide reducir movimiento, con ahorro de datos, en
// equipos modestos ni en pantallas estrechas (ver `sceneAllowed`).
// ============================================================

import type { MediaType } from "@/types/media";

/** Matiz de cada familia: mismo reparto de la paleta que los gradientes F0. */
export const TYPE_HUE: Record<MediaType, number> = {
  movie: 350,
  tv: 300,
  anime: 130,
  manga: 55,
  game: 250,
  book: 95,
  comic: 20,
};

/** Orden en que la cámara "presenta" los formatos. */
export const IMMERSIVE_FORMATS: MediaType[] = ["movie", "tv", "anime", "manga", "game", "book", "comic"];

/**
 * Color con el que se ilumina cada formato del titular mientras la galería lo
 * presenta. Es el mismo que llevaba la palabra gigante del antiguo capítulo de
 * formatos; sobre el fondo da ≥ 7:1 en los siete matices (ver test).
 */
export function formatColor(type: MediaType): string {
  return `oklch(80% 0.2 ${TYPE_HUE[type]})`;
}

/**
 * Intro automática (E-LANDING-INTRO): el recorrido lo marca el TIEMPO, no el
 * scroll. Ya no tapa el mensaje (D-11), así que dura lo mismo que antes y
 * sigue sin botón de saltar (decisión de Víctor); sí se puede pausar.
 */
export const INTRO_MS = 12000;
/** Progreso de la intro (0-1): lineal durante `INTRO_MS`. */
export function introProgress(elapsed: number): number {
  return Math.min(1, Math.max(0, elapsed / INTRO_MS));
}

/** Tramos del recorrido: los formatos y la llegada al muro final. */
export const FORMAT_FROM = 0.18;
export const FORMAT_TO = 0.68;
export const FINAL_FROM = 0.86;

/** Índice del formato que presenta la cámara para un progreso dado. */
export function formatIndexAt(p: number): number {
  const t = (p - FORMAT_FROM) / (FORMAT_TO - FORMAT_FROM);
  return Math.min(IMMERSIVE_FORMATS.length - 1, Math.max(0, Math.floor(t * IMMERSIVE_FORMATS.length)));
}

/**
 * Formato que se ilumina en el titular, o `null` fuera del tramo de formatos
 * (antes de empezar y al llegar al muro, el titular queda en su color).
 */
export function activeFormatAt(p: number): MediaType | null {
  if (p < FORMAT_FROM || p >= FINAL_FROM) return null;
  return IMMERSIVE_FORMATS[formatIndexAt(p)];
}

// ── Titular con los formatos marcados ────────────────────────────────────────

/** Trozo del titular: texto suelto o el nombre de un formato. */
export type TitlePart = string | { type: MediaType; text: string };

const TAG_RE = /<(movie|tv|anime|manga|game|book|comic)>(.*?)<\/\1>/g;

/**
 * El titular vive en los mensajes con cada formato marcado
 * (`Tu watchlist de <movie>cine</movie>, …`): una sola fuente para el texto y
 * para saber qué palabra iluminar, sin depender del orden ni del idioma.
 */
export function parseTitle(raw: string): TitlePart[] {
  const parts: TitlePart[] = [];
  let last = 0;
  const re = new RegExp(TAG_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const at = m.index;
    if (at > last) parts.push(raw.slice(last, at));
    parts.push({ type: m[1] as MediaType, text: m[2] });
    last = at + m[0].length;
  }
  if (last < raw.length) parts.push(raw.slice(last));
  return parts;
}

/** El mismo titular en texto plano (metadatos, OG, JSON-LD). */
export function plainTitle(raw: string): string {
  return raw.replace(TAG_RE, "$2");
}

// ── Textos del hero ──────────────────────────────────────────────────────────

export interface HeroCopy {
  title: TitlePart[];
  sub: string;
  badge: string;
  cta: string;
  /** Botón "Ver la demo" (E-DEMO); sin él no se pinta (demo sin configurar). */
  demo?: string;
  /** Idioma, para el formulario de la demo. */
  locale: string;
}

// ── ¿Galería WebGL o fondo quieto? ───────────────────────────────────────────

/**
 * Por debajo de este ancho no hay WebGL (MOV-13): en el móvil el hero es
 * estático, sin three ni texturas. Es una decisión de rendimiento y batería,
 * no de diseño; para volver a la galería en móvil basta con bajarlo a 0.
 */
export const WEBGL_MIN_WIDTH = 768;

/** Media query del hero animado: la usan la escena y las precargas. */
export const SCENE_MEDIA = `(min-width: ${WEBGL_MIN_WIDTH}px) and (prefers-reduced-motion: no-preference)`;

export interface SceneEnv {
  reducedMotion: boolean;
  width: number;
  saveData?: boolean;
  /** `navigator.deviceMemory` (GB, solo Chromium). */
  deviceMemory?: number;
  /** `navigator.hardwareConcurrency`. */
  cores?: number;
}

/**
 * Si la galería WebGL puede arrancar (REN-4, MOV-13, D-11). Sin ella el hero
 * es el mismo, con un collage quieto de fondo: una landing que marea, que se
 * come la batería o que tarda en responder es peor que una quieta.
 */
export function sceneAllowed(env: SceneEnv): boolean {
  if (env.reducedMotion) return false;
  if (env.width < WEBGL_MIN_WIDTH) return false;
  if (env.saveData) return false;
  if (env.deviceMemory !== undefined && env.deviceMemory <= 4) return false;
  if (env.cores !== undefined && env.cores <= 4) return false;
  return true;
}

// ── Texturas ─────────────────────────────────────────────────────────────────

/**
 * Ancho ÚNICO de textura: la misma URL la precarga el servidor
 * (`HeroBackdropSlot`) antes de que exista la escena, y con dos tamaños la
 * precarga no sabría cuál pedir y la imagen se descargaría dos veces.
 */
export const TEXTURE_WIDTH = 384;

/** Portadas que precarga el servidor con prioridad alta (REN-4: ≤ 4). */
export const IMMERSIVE_PRELOAD = 4;

/**
 * Portadas distintas que tienen que haber llegado para enseñar la galería
 * (las más cercanas a la cámara). El texto ya está pintado, así que esperar a
 * unas pocas más solo evita ver huecos de gradiente al aparecer el fondo.
 */
export const IMMERSIVE_READY_AT = 8;

/** URL de mismo origen y tamaño acotado: WebGL necesita CORS (ver la escena). */
export function textureUrl(poster: string): string {
  return `/_next/image?url=${encodeURIComponent(poster)}&w=${TEXTURE_WIDTH}&q=70`;
}
