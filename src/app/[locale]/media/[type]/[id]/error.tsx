'use client'

import { ErrorState } from '@/components/layout/ErrorState'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * La ficha es pública (D-01): "Ir al inicio" lleva a la portada, que vale con
 * y sin sesión (`/home` mandaría al login a quien no la tiene).
 */
export default function MediaDetailError({ reset }: Props) {
  return <ErrorState reset={reset} homeHref="/" />
}
