// ============================================================
// KULTURA — Tope de ampliación de la imagen de la sala
// ------------------------------------------------------------
// Biblia de diseño (`docs/design/BIBLIA.md`), §2: ninguna imagen se amplía por
// encima de 1,25 veces su tamaño natural. Solo si ninguna imagen de la obra,
// ni apaisada ni vertical, da para llenar la sala sin pasar de ese tope, la
// obra se compone como un libro, con la portada a su tamaño.
//
// Todo va en píxeles físicos: el tamaño de la sala es su tamaño CSS por
// `devicePixelRatio`. Funciones puras; quien las llama mide.
// ============================================================

/** Ampliación máxima de una imagen sobre su tamaño natural. */
export const IMAGE_MAX_UPSCALE = 1.25

export interface PixelSize {
  width: number
  height: number
}

const usable = (size: PixelSize) =>
  Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0

/**
 * Cuánto hay que ampliar una imagen para que llene la sala entera, recortando
 * lo que sobre (`object-fit: cover`): 1 es su tamaño natural, menos de 1 es
 * reducirla. `Infinity` si alguna medida no vale (imagen sin cargar, sala sin
 * tamaño): eso nunca llena la sala.
 */
export function roomScale(natural: PixelSize, room: PixelSize): number {
  if (!usable(natural) || !usable(room)) return Infinity
  return Math.max(room.width / natural.width, room.height / natural.height)
}

/** ¿Llena esta imagen la sala sin pasar del tope de ampliación? El tope justo vale. */
export function fillsRoom(natural: PixelSize, room: PixelSize): boolean {
  return roomScale(natural, room) <= IMAGE_MAX_UPSCALE
}

export type RoomLayout =
  /** La imagen `index` llena la sala, ampliada `scale` veces. */
  | { layout: 'room'; index: number; scale: number }
  /** Ninguna da: la obra se compone como un libro, con la portada a su tamaño. */
  | { layout: 'book' }

/**
 * Qué composición toca. `candidates` son los tamaños naturales de las imágenes
 * de la obra, por orden de preferencia (la apaisada sin rótulo antes que la
 * vertical); `room`, el tamaño de la sala en píxeles físicos. Gana la primera
 * que llena la sala sin pasar de 1,25×; si ninguna, libro.
 */
export function chooseRoomLayout(candidates: readonly PixelSize[], room: PixelSize): RoomLayout {
  for (let index = 0; index < candidates.length; index++) {
    const scale = roomScale(candidates[index], room)
    if (scale <= IMAGE_MAX_UPSCALE) return { layout: 'room', index, scale }
  }
  return { layout: 'book' }
}

/** Cómo se pinta una portada en su caja cuando rige el tope de ampliación. */
export type PosterFit =
  /** Da para la caja: la llena (o cabe entera, con `contain`) sin pasar del tope. */
  | { frame: 'fill' }
  /**
   * Se queda corta: va entera, ampliada como mucho hasta el tope y sin salirse.
   * `width` y `height` son su tamaño en píxeles CSS; `scale`, lo que hay que
   * encoger la imagen ya encajada entera en la caja (`object-fit: contain`)
   * para dejarla en ese tamaño: entre 0 y 1, para un `transform`.
   */
  | { frame: 'piece'; scale: number; width: number; height: number }

/**
 * Qué toca en un póster con tope. `natural` es el tamaño **del archivo** en
 * píxeles reales, no el `naturalWidth` de un `<img>` con `srcset`: ese viene
 * dividido por la densidad del candidato elegido (ancho real × `sizes` ÷
 * descriptor) y a densidad 2 o 3 hace pasar por pequeña casi cualquier
 * portada. `room`, la caja en píxeles físicos (CSS × `dpr`). `null` si alguna
 * medida no vale: todavía no se puede decidir.
 */
export function posterFit(
  natural: PixelSize,
  room: PixelSize,
  dpr: number,
  fit: 'cover' | 'contain' = 'cover'
): PosterFit | null {
  if (!usable(natural) || !usable(room) || !(dpr > 0)) return null
  const whole = Math.min(room.width / natural.width, room.height / natural.height)
  const needed = fit === 'cover' ? roomScale(natural, room) : whole
  if (needed <= IMAGE_MAX_UPSCALE) return { frame: 'fill' }
  const shown = Math.min(whole, IMAGE_MAX_UPSCALE)
  return {
    frame: 'piece',
    scale: Math.round((shown / whole) * 10000) / 10000,
    width: Math.round((natural.width * shown) / dpr),
    height: Math.round((natural.height * shown) / dpr),
  }
}
