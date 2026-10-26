'use client'

// ============================================================
// KULTURA — Ajustes › Mis plataformas (F-25, PRO-6)
//
// Casillas nativas (Tab, Espacio y lector de pantalla sin trabajo extra) con
// el catálogo de TMDB de la región elegida. Se guarda solo, con una pausa
// corta para agrupar varios toques, con el JWT del usuario: la migración da
// GRANT de estas dos columnas y la RLS (users_update_own + demo_no_update)
// decide. La cuenta demo lo ve pero no lo cambia.
// ============================================================

import { useEffect, useId, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/index'
import { PLATFORMS_BY_REGION, PLATFORM_REGIONS, type PlatformRegion } from './platforms'

export const PLATFORMS_SAVE_DELAY_MS = 700

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface PlatformsSectionProps {
  userId: string
  initialServices: number[]
  initialRegion: PlatformRegion
  isDemo?: boolean
}

export function PlatformsSection({ userId, initialServices, initialRegion, isDemo = false }: PlatformsSectionProps) {
  const t = useTranslations('platforms')
  const regionId = useId()
  const [services, setServices] = useState<number[]>(initialServices)
  const [region, setRegion] = useState<PlatformRegion>(initialRegion)
  const [state, setState] = useState<SaveState>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<{ services: number[]; region: PlatformRegion } | null>(null)
  const saved = useRef({ services: initialServices, region: initialRegion })

  const catalog = PLATFORMS_BY_REGION[region]

  async function flush() {
    const next = pending.current
    pending.current = null
    timer.current = null
    if (!next) return
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('users')
        .update({ streaming_services: next.services, streaming_region: next.region })
        .eq('id', userId)
        .select('id')
      // 0 filas = la RLS no dejó (p. ej. demo): también es un fallo.
      if (error || !data || data.length === 0) throw new Error(error?.message ?? 'not updated')
      saved.current = next
      if (!pending.current) setState('saved')
    } catch {
      setServices(saved.current.services)
      setRegion(saved.current.region)
      setState('error')
    }
  }

  function schedule(next: { services: number[]; region: PlatformRegion }) {
    pending.current = next
    setState('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), PLATFORMS_SAVE_DELAY_MS)
  }

  // Si se sale de Ajustes con un cambio a medias, se guarda ya.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current)
        void flush()
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  function toggle(id: number) {
    const next = services.includes(id) ? services.filter((s) => s !== id) : [...services, id]
    setServices(next)
    schedule({ services: next, region })
  }

  function changeRegion(value: string) {
    const nextRegion = value as PlatformRegion
    // Lo marcado que no existe en el catálogo nuevo se quita (no quedaría a la vista).
    const ids = new Set(PLATFORMS_BY_REGION[nextRegion].map((p) => p.id))
    const nextServices = services.filter((s) => ids.has(s))
    setRegion(nextRegion)
    setServices(nextServices)
    schedule({ services: nextServices, region: nextRegion })
  }

  const selectedHere = catalog.filter((p) => services.includes(p.id)).length

  return (
    <section id="platforms" aria-labelledby="platforms-title" className="scroll-mt-24">
      <h2 id="platforms-title" className="text-[13px] font-extrabold uppercase tracking-wide text-text-tertiary mb-3">
        {t('title')}
      </h2>
      <div className="flex flex-col gap-5 rounded-20 bg-surface-default px-5 py-4 sm:px-6 sm:py-5">
        <p className="text-sm font-body text-text-tertiary">{t('hint')}</p>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label htmlFor={regionId} className="text-sm font-semibold text-text-primary">
            {t('region')}
          </label>
          <select
            id={regionId}
            value={region}
            disabled={isDemo}
            onChange={(e) => changeRegion(e.target.value)}
            className="min-h-11 rounded-button border border-field-border bg-surface-base px-3 py-2 text-base md:text-sm text-text-primary focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:opacity-50"
          >
            {PLATFORM_REGIONS.map((r) => (
              <option key={r} value={r}>{t(`regions.${r}`)}</option>
            ))}
          </select>
        </div>

        <fieldset disabled={isDemo} className="flex flex-col gap-3 disabled:opacity-60">
          <legend className="mb-2 flex w-full flex-wrap items-baseline justify-between gap-2 text-sm font-semibold text-text-primary">
            <span>{t('groupLabel')}</span>
            <span className="text-xs font-body font-normal text-text-tertiary">{t('count', { count: selectedHere })}</span>
          </legend>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {catalog.map((p) => {
              const checked = services.includes(p.id)
              return (
                <li key={p.id}>
                  <label
                    className={cn(
                      'flex min-h-11 cursor-pointer items-center gap-3 rounded-[14px] bg-surface-elevated px-3 py-2.5 transition-colors',
                      checked && 'ring-2 ring-accent-pink'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(p.id)}
                      className="h-5 w-5 flex-shrink-0 cursor-pointer accent-accent-pink"
                    />
                    <span className="text-sm font-bold text-text-primary">{p.name}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </fieldset>

        {isDemo ? <p className="text-sm text-text-tertiary">{t('demoLocked')}</p> : null}
        <p role="status" className="min-h-5 text-[13px] text-text-tertiary">
          {state === 'saving' ? t('saving') : state === 'saved' ? t('saved') : ''}
        </p>
        {state === 'error' ? <p role="alert" className="text-sm text-accent-danger">{t('error')}</p> : null}
        <p className="text-[11px] text-text-tertiary">{t('attribution')}</p>
      </div>
    </section>
  )
}
