'use client'

// ============================================================
// KULTURA — Aviso «¿Te avisamos?» en contexto (F-33, remate)
//
// No hace nada al montar: espera al evento de `offerPushInContext()` (tras
// enviar un mensaje o pedir/aceptar una amistad). Solo entonces monta
// `PushOfferCard`, que lee el estado con `usePushSettings` y se enseña si el
// push está encendido en el servidor y aún no hay suscripción ni permiso
// decidido. El permiso del navegador se pide al pulsar «Activar avisos».
// ============================================================

import { useCallback, useEffect, useId, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { IconBell } from '@/components/icons'
import { usePushSettings } from '@/lib/push/client'
import {
  PUSH_OFFER_EVENT,
  canOfferPush,
  dismissPushOffer,
  markPushOfferShown,
  type PushOfferContext,
} from '@/lib/push/offer'

type Win = Window & typeof globalThis

/** Lo que se queda a la vista el «Listo» tras activarlos. */
const DONE_VISIBLE_MS = 3000

export function PushOffer() {
  const [context, setContext] = useState<PushOfferContext | null>(null)

  useEffect(() => {
    const onOffer = (event: Event) => {
      const win = window as Win
      if (!canOfferPush(win)) return
      markPushOfferShown(win)
      setContext((event as CustomEvent<PushOfferContext>).detail === 'friends' ? 'friends' : 'chat')
    }
    window.addEventListener(PUSH_OFFER_EVENT, onOffer)
    return () => window.removeEventListener(PUSH_OFFER_EVENT, onOffer)
  }, [])

  const close = useCallback(() => setContext(null), [])
  if (!context) return null
  return <PushOfferCard context={context} onClose={close} />
}

function PushOfferCard({ context, onClose }: { context: PushOfferContext; onClose: () => void }) {
  const t = useTranslations('push.offer')
  const locale = useLocale()
  const titleId = useId()
  const { state, notice, enable } = usePushSettings(locale)
  const [asked, setAsked] = useState(false)

  // Nada que ofrecer (push apagado, sin service worker, iPhone sin instalar,
  // ya activado en otro momento): se cierra sin decir nada.
  const nothingToOffer = !asked && state !== 'loading' && state !== 'off'
  useEffect(() => {
    if (nothingToOffer) onClose()
  }, [nothingToOffer, onClose])

  // Tras activarlos, «Listo» un momento y se va.
  const done = asked && state === 'on'
  useEffect(() => {
    if (!done) return
    const timer = window.setTimeout(onClose, DONE_VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [done, onClose])

  if (state === 'loading' || nothingToOffer) return null

  const later = () => {
    dismissPushOffer(window as Win)
    onClose()
  }
  const activate = () => {
    setAsked(true)
    void enable()
  }

  const message = done
    ? t('done')
    : asked && state === 'denied'
      ? t('denied')
      : asked && (notice === 'error' || state === 'unsupported')
        ? t('error')
        : t(context === 'friends' ? 'friendsBody' : 'chatBody')

  return (
    <aside
      aria-labelledby={titleId}
      data-testid="push-offer"
      className="fixed z-40 inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:inset-x-auto md:left-4 md:bottom-4 md:w-96 rounded-2xl border border-surface-border bg-surface-elevated p-4 text-text-primary shadow-soft motion-safe:animate-toast-in"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-surface-default text-accent-pink">
          <IconBell className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="font-display text-base font-bold leading-snug">
            {t('title')}
          </h2>
          <p role="status" className="mt-1 text-sm text-text-secondary">
            {message}
          </p>
        </div>
      </div>
      {done || (asked && state === 'denied') ? (
        <div className="mt-3 flex justify-end">
          <KButton type="button" variant="secondary" size="sm" onClick={onClose}>
            {t('close')}
          </KButton>
        </div>
      ) : (
        <div className="mt-3 flex justify-end gap-2">
          <KButton type="button" variant="secondary" size="sm" onClick={later}>
            {t('later')}
          </KButton>
          <KButton type="button" variant="primary" size="sm" loading={state === 'saving'} onClick={activate}>
            {t('enable')}
          </KButton>
        </div>
      )}
    </aside>
  )
}
