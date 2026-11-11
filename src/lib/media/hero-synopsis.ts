// ============================================================
// KULTURA — Sinopsis del hero de Inicio en el idioma activo (saneamiento 5.3)
//
// La sinopsis del hero es la guardada en `media`, que suele estar en el
// idioma del proveedor (inglés en anime, juegos y cómics). Inicio no espera
// al modelo: usa la traducción si ya está en caché y, si no, la pide después
// de responder (`after`) para la siguiente visita.
// ============================================================

import { after } from 'next/server'
import { translateSynopsis } from '@/lib/translate/synopsis'
import type { HeroItem } from '@/components/home/HeroSection'

export async function localizeHeroSynopsis(item: HeroItem, locale: string): Promise<HeroItem> {
  const text = item.media?.synopsis
  if (!item.media || !text) return item
  const translated = await translateSynopsis({ text, locale, mediaId: item.media_id, cacheOnly: true })
  if (translated === text.trim()) {
    // Sin traducción en caché (o no hacía falta: entonces no llama al modelo).
    after(() => translateSynopsis({ text, locale, mediaId: item.media_id }).then(() => undefined))
  }
  return { ...item, media: { ...item.media, synopsis: translated } }
}
