// ============================================================
// KULTURA — Receptor de `share_target` (F-23, MOV-9)
//
// Con la app instalada, "Compartir → KULTURA" desde otra app abre
// `/{locale}/share?title=&text=&url=` (ver `src/app/manifest.ts`). Aquí se
// saca el título de lo compartido y se abre la búsqueda; sin nada útil, se
// abre Descubrir. La búsqueda está en la zona con sesión: sin sesión, su
// layout manda al login con `next` y vuelve después.
// ============================================================

import { NextResponse } from 'next/server'
import { isAppLocale } from '@/i18n/detect'
import { routing } from '@/i18n/routing'
import { shareQuery } from '@/components/pwa/share-target'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params
  const locale = isAppLocale(raw) ? raw : routing.defaultLocale
  const { searchParams } = new URL(request.url)
  const query = shareQuery({
    title: searchParams.get('title'),
    text: searchParams.get('text'),
    url: searchParams.get('url'),
  })
  const target = query
    ? `/${locale}/search?${new URLSearchParams({ q: query }).toString()}`
    : `/${locale}/discover`
  return NextResponse.redirect(new URL(target, request.url), 303)
}
