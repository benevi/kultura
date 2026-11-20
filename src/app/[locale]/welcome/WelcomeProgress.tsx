'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils/index'
import type { Step } from './welcome-steps'

/** Barra de segmentos (uno por paso): hecho = lima, actual = pink, pendiente = superficie. */
export function WelcomeProgress({ steps, current }: { steps: readonly Step[]; current: number }) {
  const t = useTranslations('onboarding')
  return (
    <nav aria-label={t('progressLabel')}>
      <p className="sr-only">{t('stepOf', { current: current + 1, total: steps.length })}</p>
      <ol className={cn('grid gap-2', steps.length === 3 ? 'grid-cols-3' : 'grid-cols-4')}>
        {steps.map((step, i) => (
          <li key={step} aria-current={i === current ? 'step' : undefined} className="flex flex-col gap-2">
            <span
              aria-hidden="true"
              className={cn(
                'block h-1.5 rounded-pill transition-colors duration-300',
                i < current ? 'bg-accent-lime' : i === current ? 'bg-accent-pink' : 'bg-surface-elevated'
              )}
            />
            <span
              className={cn(
                'hidden font-body text-xs font-bold sm:block',
                i === current ? 'text-text-primary' : 'text-text-tertiary'
              )}
            >
              {t(`steps.${step}`)}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  )
}
