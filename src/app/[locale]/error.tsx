'use client'

import dynamic from 'next/dynamic'

// Este límite va en el JS inicial de TODAS las páginas de `[locale]`, también
// de las cacheables (portada, rankings, legales). El estado de error de «Sala»
// trae `SalaButton`, `SalaBlockState` y `cn` (tailwind-merge, ≈ 10 KB gz), que
// solo hacen falta si algo falla: se piden entonces. Si esa descarga falla
// también, el error sube a `global-error.tsx`, que no depende de nada.
const ErrorState = dynamic(() => import('@/components/layout/ErrorState').then((m) => m.ErrorState), {
  // Mientras llega, el mismo hueco que ocupará (sin texto: dura un instante).
  loading: () => <main className="page-grid min-h-[60vh]" />,
})

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Cubre las páginas públicas: «Ir al inicio» lleva a la portada, que vale con
 * y sin sesión (`/home` mandaría al login a quien no la tiene).
 */
export default function LocaleError({ error, reset }: Props) {
  return <ErrorState error={error} reset={reset} fullPage homeHref="/" />
}
