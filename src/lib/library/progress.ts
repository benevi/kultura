// ============================================================
// KULTURA — Progreso por formato (F-27, PRO-5). Puro: sirve en cliente,
// servidor y tests.
//
// Cada formato cuenta lo suyo:
//   tv            temporada + episodio  (total = episodios de ESA temporada)
//   anime         episodio              (total = episodios de la serie)
//   manga, comic  capítulo + volumen    (total = capítulos / números)
//   book          página o %            (total = páginas)
//   game          horas jugadas         (total = horas medias de RAWG)
//   movie         nada
//
// Dónde se guarda: con PROGRESS_V2=1 y la migración 20261215270001 aplicada,
// en las columnas `progress_*` de user_media; si no, como siempre, en el
// jsonb `episode_progress` ({season?, episode}, solo series y anime). El
// disparador de la migración mantiene el jsonb como espejo de las columnas,
// así que leer el jsonb sirve en los dos mundos (`progressFromJson`).
// ============================================================

import type { EpisodeProgress, LibraryEntry, LibraryPayload } from '@/types/library'

export type ProgressKind = 'tv' | 'anime' | 'reading' | 'book' | 'game'

/** Progreso de un título. Cada campo es opcional; `null` = sin dato. */
export interface ProgressValue {
  season?: number | null
  episode?: number | null
  chapter?: number | null
  volume?: number | null
  page?: number | null
  percent?: number | null
  hours?: number | null
  /** Total de la unidad principal (copiado del proveedor). */
  total?: number | null
}

export type ProgressField = Exclude<keyof ProgressValue, 'total'>

/** Entrada de biblioteca con su progreso por formato (null = sin progreso). */
export type LibraryEntryWithProgress = LibraryEntry & { progress?: ProgressValue | null }

/** Cuerpo de POST /api/library con el progreso por formato (PROGRESS_V2). */
export type LibraryPayloadWithProgress = LibraryPayload & { progress?: ProgressValue | null }

/** Rangos: los mismos CHECK que la migración. `whole` = entero. */
export const PROGRESS_LIMITS: Record<keyof ProgressValue, { min: number; max: number; step: number; whole: boolean }> = {
  season: { min: 0, max: 999, step: 1, whole: true },
  episode: { min: 1, max: 99999, step: 1, whole: true },
  chapter: { min: 0, max: 99999.9, step: 1, whole: false },
  volume: { min: 0, max: 9999, step: 1, whole: true },
  page: { min: 0, max: 100000, step: 1, whole: true },
  percent: { min: 0, max: 100, step: 1, whole: true },
  hours: { min: 0, max: 99999.9, step: 0.5, whole: false },
  total: { min: 1, max: 100000, step: 1, whole: true },
}

/** Lo que suma un toque en «Continúa» (libros y juegos; el resto, +1). */
export const QUICK_STEP = { page: 10, percent: 5, hours: 1 } as const

const FIELDS_BY_KIND: Record<ProgressKind, ProgressField[]> = {
  tv: ['season', 'episode'],
  anime: ['episode'],
  reading: ['chapter', 'volume'],
  book: ['page', 'percent'],
  game: ['hours'],
}

export function progressKindFor(mediaType: string | null | undefined): ProgressKind | null {
  switch (mediaType) {
    case 'tv':
      return 'tv'
    case 'anime':
      return 'anime'
    case 'manga':
    case 'comic':
      return 'reading'
    case 'book':
      return 'book'
    case 'game':
      return 'game'
    default:
      return null
  }
}

/** Campos que admite cada formato. */
export function progressFieldsFor(mediaType: string): ProgressField[] {
  const kind = progressKindFor(mediaType)
  return kind ? FIELDS_BY_KIND[kind] : []
}

/** Sin la migración solo se guarda el progreso de episodios (series y anime). */
export function supportsLegacyProgress(mediaType: string): boolean {
  return mediaType === 'tv' || mediaType === 'anime'
}

function inRange(field: keyof ProgressValue, n: unknown): n is number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return false
  const lim = PROGRESS_LIMITS[field]
  if (n < lim.min || n > lim.max) return false
  return !lim.whole || Number.isInteger(n)
}

/** Redondea al decimal que guarda la base (capítulos y horas: 1 decimal). */
function normalizeNumber(field: keyof ProgressValue, n: number): number {
  return PROGRESS_LIMITS[field].whole ? n : Math.round(n * 10) / 10
}

/** ¿Tiene algún dato de progreso (el total solo no cuenta)? */
export function hasProgress(value: ProgressValue | null | undefined): boolean {
  if (!value) return false
  return (Object.keys(FIELD_ORDER) as ProgressField[]).some((f) => typeof value[f] === 'number')
}

const FIELD_ORDER: Record<ProgressField, true> = {
  season: true,
  episode: true,
  chapter: true,
  volume: true,
  page: true,
  percent: true,
  hours: true,
}

/** Copia sin campos vacíos; `null` si no queda progreso. */
export function compactProgress(value: ProgressValue | null | undefined): ProgressValue | null {
  if (!hasProgress(value)) return null
  const out: ProgressValue = {}
  for (const key of [...(Object.keys(FIELD_ORDER) as ProgressField[]), 'total' as const]) {
    const n = value?.[key]
    if (typeof n === 'number') out[key] = n
  }
  return out
}

/**
 * Lee el progreso del jsonb `episode_progress` (forma antigua `{season?,
 * episode}` o espejo de las columnas). Lo que no es número o se sale del
 * rango se descarta: un jsonb raro nunca rompe la página.
 */
export function progressFromJson(json: unknown): ProgressValue | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null
  const src = json as Record<string, unknown>
  const out: ProgressValue = {}
  for (const key of Object.keys(PROGRESS_LIMITS) as (keyof ProgressValue)[]) {
    const n = src[key]
    if (inRange(key, n)) out[key] = normalizeNumber(key, n)
  }
  return hasProgress(out) ? out : null
}

/** Columnas de user_media (con la migración aplicada). */
export interface ProgressColumns {
  progress_season: number | null
  progress_episode: number | null
  progress_chapter: number | null
  progress_volume: number | null
  progress_page: number | null
  progress_percent: number | null
  progress_hours: number | null
  progress_total: number | null
}

const COLUMN_OF: Record<keyof ProgressValue, keyof ProgressColumns> = {
  season: 'progress_season',
  episode: 'progress_episode',
  chapter: 'progress_chapter',
  volume: 'progress_volume',
  page: 'progress_page',
  percent: 'progress_percent',
  hours: 'progress_hours',
  total: 'progress_total',
}

/** ¿La fila trae las columnas de la migración (`select('*')` con ella aplicada)? */
export function rowHasProgressColumns(row: object | null | undefined): boolean {
  return !!row && 'progress_episode' in row
}

/**
 * Progreso de una fila de user_media: las columnas si existen; si no, el
 * jsonb de siempre. PostgREST devuelve `numeric` como número.
 */
export function progressFromRow(row: Record<string, unknown> | null | undefined): ProgressValue | null {
  if (!row) return null
  if (!rowHasProgressColumns(row)) return progressFromJson(row.episode_progress)
  const fromColumns: Record<string, unknown> = {}
  for (const [key, column] of Object.entries(COLUMN_OF)) {
    const raw = row[column]
    fromColumns[key] = typeof raw === 'string' ? Number(raw) : raw
  }
  return progressFromJson(fromColumns) ?? progressFromJson(row.episode_progress)
}

/** Todas las columnas (las que no van, a NULL: guardar = sustituir). */
export function progressToColumns(value: ProgressValue | null): ProgressColumns {
  const out = {} as ProgressColumns
  for (const [key, column] of Object.entries(COLUMN_OF) as [keyof ProgressValue, keyof ProgressColumns][]) {
    const n = value?.[key]
    out[column] = typeof n === 'number' ? n : null
  }
  return out
}

/** Forma antigua del jsonb (`{season?, episode}`), o null si no hay episodio. */
export function progressToLegacy(value: ProgressValue | null | undefined): EpisodeProgress | null {
  if (!value || typeof value.episode !== 'number') return null
  return typeof value.season === 'number' ? { season: value.season, episode: value.episode } : { episode: value.episode }
}

export type ParsedProgress = { ok: true; value: ProgressValue | null } | { ok: false; error: string }

/**
 * Valida lo que manda el cliente para un formato: solo sus campos, dentro
 * de rango. `null` borra el progreso. Un campo de otro formato es un 400
 * (p. ej. páginas en una serie), no algo que se ignore en silencio.
 */
export function parseProgressInput(mediaType: string, input: unknown): ParsedProgress {
  if (input === null) return { ok: true, value: null }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'progress must be an object or null' }
  }
  const allowed = new Set<string>([...progressFieldsFor(mediaType), 'total'])
  if (allowed.size === 1) return { ok: false, error: `progress is not supported for ${mediaType}` }
  const out: ProgressValue = {}
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    if (raw === null || raw === undefined) continue
    if (!allowed.has(key)) return { ok: false, error: `progress.${key} is not valid for ${mediaType}` }
    const field = key as keyof ProgressValue
    if (!inRange(field, raw)) {
      const lim = PROGRESS_LIMITS[field]
      return { ok: false, error: `progress.${key} must be between ${lim.min} and ${lim.max}` }
    }
    out[field] = normalizeNumber(field, raw)
  }
  // Libro: páginas o porcentaje, no las dos (se queda la que no es 0 o la página).
  if (typeof out.page === 'number' && typeof out.percent === 'number') delete out.percent
  return { ok: true, value: compactProgress(out) }
}

// ── Plan del proveedor y «marcar siguiente» ──────────────────────────────────

export interface SeasonPlan {
  number: number
  episodes: number
}

/**
 * Lo que dice el proveedor del título. Todo opcional: con el proveedor caído
 * (o bloqueado) se avanza igual, solo que sin saber dónde acaba.
 */
export interface ProgressPlan {
  /** Total de la unidad principal (anime: episodios; manga/cómic: capítulos o
   * números; libro: páginas; juego: horas medias de RAWG). Series: no se usa
   * (cada temporada tiene el suyo en `seasons`). */
  total?: number | null
  /** Volúmenes publicados (manga). */
  volumes?: number | null
  /** Temporadas normales de la serie (sin especiales), en orden. */
  seasons?: SeasonPlan[]
  /** Último episodio emitido (series en emisión). */
  lastAired?: { season: number; episode: number } | null
  /** La obra está terminada (serie finalizada o cancelada, manga completo). */
  ended?: boolean
}

export interface NextResult {
  value: ProgressValue
  /** Lo marcado es el final: se propone pasar a «Completado». */
  finished: boolean
  /** Serie al día: no hay episodio emitido después del marcado. */
  caughtUp: boolean
}

function cmpEpisode(a: { season: number; episode: number }, b: { season: number; episode: number }): number {
  return a.season === b.season ? a.episode - b.episode : a.season - b.season
}

function regularSeasons(plan: ProgressPlan | null | undefined): SeasonPlan[] {
  return (plan?.seasons ?? [])
    .filter((s) => s.number >= 1 && s.episodes > 0)
    .sort((a, b) => a.number - b.number)
}

/** Total de la temporada (series) o de la obra (el resto) para un progreso. */
export function totalFor(mediaType: string, value: ProgressValue | null, plan: ProgressPlan | null | undefined): number | null {
  if (progressKindFor(mediaType) === 'tv') {
    const season = value?.season ?? 1
    return regularSeasons(plan).find((s) => s.number === season)?.episodes ?? null
  }
  const total = plan?.total
  return typeof total === 'number' && total >= 1 ? Math.round(total) : null
}

/** ¿Este progreso es el final de la obra? */
export function isAtEnd(mediaType: string, value: ProgressValue | null, plan: ProgressPlan | null | undefined): boolean {
  if (!value) return false
  const kind = progressKindFor(mediaType)
  if (kind === 'tv') {
    const seasons = regularSeasons(plan)
    const last = seasons[seasons.length - 1]
    if (!last || typeof value.episode !== 'number') return false
    const here = { season: value.season ?? 1, episode: value.episode }
    if (cmpEpisode(here, { season: last.number, episode: last.episodes }) < 0) return false
    // El último episodio de TMDB solo es el final si la serie terminó
    // (en emisión, o sin estado, puede haber más).
    return plan?.ended === true
  }
  const total = totalFor(mediaType, value, plan)
  if (kind === 'anime') return total !== null && (value.episode ?? 0) >= total
  if (kind === 'reading') return total !== null && (value.chapter ?? 0) >= total
  if (kind === 'book') {
    if (typeof value.percent === 'number') return value.percent >= 100
    return total !== null && (value.page ?? 0) >= total
  }
  // Las horas no dicen si un juego está terminado.
  return false
}

/**
 * Lo que marca un toque en «Continúa» o en el botón «Marcar siguiente».
 * Series: siguiente episodio de la temporada o primero de la siguiente (sin
 * pasar del último emitido). Anime: +1 episodio. Manga y cómic: +1 capítulo.
 * Libro: +10 páginas o +5 %. Juego: +1 hora.
 */
export function nextProgress(
  mediaType: string,
  current: ProgressValue | null,
  plan?: ProgressPlan | null
): NextResult | null {
  const kind = progressKindFor(mediaType)
  if (!kind) return null
  const base: ProgressValue = { ...(current ?? {}) }
  const done = (value: ProgressValue, caughtUp = false): NextResult => {
    const total = totalFor(mediaType, value, plan)
    const withTotal = compactProgress({ ...value, total: total ?? value.total ?? null }) ?? value
    return { value: withTotal, finished: !caughtUp && isAtEnd(mediaType, withTotal, plan), caughtUp }
  }

  if (kind === 'tv') {
    const seasons = regularSeasons(plan)
    let target: { season: number; episode: number }
    if (typeof base.episode !== 'number') {
      target = { season: base.season ?? seasons[0]?.number ?? 1, episode: 1 }
    } else {
      const season = base.season ?? seasons[0]?.number ?? 1
      const info = seasons.find((s) => s.number === season)
      if (info && base.episode >= info.episodes) {
        const following = seasons.find((s) => s.number > season)
        // Último episodio de la última temporada: no hay más que marcar. Si la
        // serie terminó, se propone completar; si no, estás al día.
        if (!following) return done({ ...base, season }, plan?.ended !== true)
        target = { season: following.number, episode: 1 }
      } else {
        target = { season, episode: base.episode + 1 }
      }
    }
    if (plan?.lastAired && cmpEpisode(target, plan.lastAired) > 0) {
      return done({ ...base, season: base.season ?? target.season }, true)
    }
    return done({ ...base, season: target.season, episode: target.episode })
  }

  if (kind === 'anime') {
    const total = totalFor(mediaType, base, plan)
    const episode = (base.episode ?? 0) + 1
    if (total !== null && episode > total) return done({ ...base, episode: Math.max(base.episode ?? total, 1) })
    return done({ ...base, episode })
  }

  if (kind === 'reading') {
    const total = totalFor(mediaType, base, plan)
    const chapter = Math.floor(base.chapter ?? 0) + 1
    if (total !== null && chapter > total) return done({ ...base, chapter: base.chapter ?? total })
    return done({ ...base, chapter: Math.min(chapter, PROGRESS_LIMITS.chapter.max) })
  }

  if (kind === 'book') {
    const total = totalFor(mediaType, base, plan)
    const usePercent = typeof base.percent === 'number' || (typeof base.page !== 'number' && total === null)
    if (usePercent) {
      return done({ percent: Math.min(100, (base.percent ?? 0) + QUICK_STEP.percent), total: base.total })
    }
    const current = base.page ?? 0
    const page = Math.min(current + QUICK_STEP.page, total ?? PROGRESS_LIMITS.page.max)
    // Nunca hacia atrás (p. ej. si ya ibas por encima del total de la ficha).
    return done({ page: Math.max(current, page), total: base.total })
  }

  // game
  const hours = Math.min((base.hours ?? 0) + QUICK_STEP.hours, PROGRESS_LIMITS.hours.max)
  return done({ ...base, hours: Math.round(hours * 10) / 10 })
}

/**
 * Proporción hecha (0-1) para la barra, o null si no se sabe el total.
 * Juegos: horas frente a la media de RAWG (topada en 1).
 */
export function progressRatio(mediaType: string, value: ProgressValue | null | undefined): number | null {
  if (!value) return null
  const kind = progressKindFor(mediaType)
  const total = typeof value.total === 'number' && value.total > 0 ? value.total : null
  let done: number | null = null
  if (kind === 'book' && typeof value.percent === 'number') return Math.min(1, value.percent / 100)
  if (kind === 'tv' || kind === 'anime') done = value.episode ?? null
  else if (kind === 'reading') done = value.chapter ?? null
  else if (kind === 'book') done = value.page ?? null
  else if (kind === 'game') done = value.hours ?? null
  if (done === null || total === null) return null
  return Math.max(0, Math.min(1, done / total))
}

/**
 * Porcentaje entero para mostrar ("45 %"), o null. Hacia abajo: 349 de 350
 * páginas es un 99 %, no un 100 % que parezca terminado.
 */
export function progressPercent(mediaType: string, value: ProgressValue | null | undefined): number | null {
  const ratio = progressRatio(mediaType, value)
  return ratio === null ? null : Math.floor(ratio * 100 + 1e-9)
}

/**
 * Unidad que avanza un toque (para el texto del botón). Libro sin progreso:
 * `advance` (neutro), porque el servidor decide páginas o % según tenga o no
 * el total de la ficha, y el cliente no lo sabe.
 */
export type QuickUnit = 'episode' | 'chapter' | 'page' | 'percent' | 'hours' | 'advance'

export function quickUnit(mediaType: string, value: ProgressValue | null | undefined): QuickUnit | null {
  const kind = progressKindFor(mediaType)
  if (kind === 'tv' || kind === 'anime') return 'episode'
  if (kind === 'reading') return 'chapter'
  if (kind === 'game') return 'hours'
  if (kind === 'book') {
    if (typeof value?.percent === 'number') return 'percent'
    if (typeof value?.page === 'number') return 'page'
    return 'advance'
  }
  return null
}
