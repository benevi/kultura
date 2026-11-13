'use client'

import { ErrorState } from '@/components/layout/ErrorState'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function LocaleError({ error, reset }: Props) {
  return <ErrorState error={error} reset={reset} minHeight="min-h-[60vh]" />
}
