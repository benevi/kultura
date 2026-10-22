// ============================================================
// KULTURA — Lo popular para una cuenta sin señal (E-INICIO-ARRANQUE)
//
// Una cuenta con menos de 3 títulos puntuados o completados no tiene gustos
// con los que recomendar. En vez de dejar "Para ti" vacío se enseña lo más
// popular ahora mismo, un título de cada formato. Sale de la misma muestra
// cacheada de la landing, así que no cuesta peticiones a proveedores ni IA.
// ============================================================

import { getLandingShowcase, showcaseToMediaItem } from '@/lib/landing/showcase'
import type { MediaItem } from '@/types/media'

/** Un título por formato: la muestra arranca con uno de cada tipo. */
export const STARTER_SIZE = 7

export async function getStarterItems(locale: string): Promise<MediaItem[]> {
  return (await getLandingShowcase(locale)).slice(0, STARTER_SIZE).map(showcaseToMediaItem)
}
