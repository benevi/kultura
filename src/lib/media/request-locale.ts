// ============================================================
// KULTURA — Idioma en el que se crea una fila nueva de `media`
//
// Las rutas de la API no llevan locale en la URL. Antes el título llegaba ya
// localizado en `mediaCache`; ahora la ficha la pide el servidor, así que hace
// falta saber en qué idioma pedirla: el de la página desde la que se guarda
// (`Referer: …/en/media/…`), luego la cookie de next-intl y, si no, el idioma
// por defecto. Nunca lanza.
// ============================================================

import { DEFAULT_API_LOCALE, type ApiLocale } from '@/lib/api/locale'

const LOCALES: readonly ApiLocale[] = ['es', 'en']

function asLocale(value: string | null | undefined): ApiLocale | null {
  return value && (LOCALES as readonly string[]).includes(value) ? (value as ApiLocale) : null
}

export function localeFromRequest(request: Request): ApiLocale {
  const referer = request.headers.get('referer')
  if (referer) {
    try {
      const fromPath = asLocale(new URL(referer).pathname.split('/')[1])
      if (fromPath) return fromPath
    } catch {
      // Referer malformado: se ignora.
    }
  }

  const cookie = request.headers.get('cookie') ?? ''
  const match = /(?:^|;\s*)NEXT_LOCALE=([^;]+)/.exec(cookie)
  return asLocale(match?.[1]) ?? DEFAULT_API_LOCALE
}
