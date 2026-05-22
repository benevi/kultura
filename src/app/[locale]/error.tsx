'use client'

import { ErrorState } from '@/components/layout/ErrorState'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function LocaleError({ reset }: Props) {
  return <ErrorState reset={reset} minHeight="min-h-[60vh]" />
}
