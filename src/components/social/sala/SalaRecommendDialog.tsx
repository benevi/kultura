'use client'

// ============================================================
// KULTURA — SalaRecommendDialog (fase 8.5, F2d, ficha con `SALA_FICHA`)
// «Recomendar a un amigo» en «Sala»: lo mismo que `RecommendModal` (el
// estado sale de `useRecommendForm`) con `SalaDialog` (hoja en móvil),
// `SalaCheckbox`, `SalaTextarea` y `SalaButton`. Llega por next/dynamic
// (`SalaSocialDialogsLazy`): la ficha de hoy no lo descarga.
// ============================================================

import type { RefObject } from 'react'
import { useTranslations } from 'next-intl'
import { Avatar } from '@/components/ui/Avatar'
import { SalaDialog } from '@/components/sala/SalaDialog'
import { SalaButton } from '@/components/sala/SalaButton'
import { SalaCheckbox } from '@/components/sala/SalaCheckbox'
import { SalaTextarea } from '@/components/sala/SalaTextarea'
import { useRecommendForm, type RecommendMediaCache } from '@/components/social/useRecommendForm'
import { useWorkPalette } from './useWorkPalette'

export interface SalaRecommendDialogProps {
  open: boolean
  onClose: () => void
  /** El botón que lo abre: de su obra sale la paleta. */
  anchorRef?: RefObject<HTMLElement | null>
  mediaId: string
  mediaCache: RecommendMediaCache
}

export function SalaRecommendDialog({ open, anchorRef, ...props }: SalaRecommendDialogProps) {
  const palette = useWorkPalette(anchorRef, open)
  // El formulario nace con cada apertura: amigos recién cargados, nada elegido.
  if (!open) return null
  return <SalaRecommendDialogOpen {...props} palette={palette} />
}

function SalaRecommendDialogOpen({
  onClose,
  mediaId,
  mediaCache,
  palette,
}: Omit<SalaRecommendDialogProps, 'open' | 'anchorRef'> & { palette: ReturnType<typeof useWorkPalette> }) {
  const t = useTranslations('recommendations')
  const tc = useTranslations('common')
  const { friends, loadingFriends, selected, toggleFriend, message, setMessage, status, handleSend } =
    useRecommendForm(mediaId, mediaCache, onClose)
  const sending = status === 'sending'
  const canSend = friends.length > 0 && status !== 'sent'

  return (
    <SalaDialog
      open
      onClose={onClose}
      variant="sheet"
      title={t('recommendTo')}
      closeLabel={tc('close')}
      dismissible={!sending}
      error={status === 'error' ? t('error') : null}
      palette={palette}
      footer={
        <>
          <SalaButton variant={canSend ? 'quiet' : 'secondary'} onClick={onClose} disabled={sending}>
            {t('cancel')}
          </SalaButton>
          {canSend && (
            <SalaButton variant="primary" loading={sending} loadingLabel={tc('loading')} disabled={selected.size === 0} onClick={handleSend}>
              {t('send')}
            </SalaButton>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Casillas nativas dentro de un grupo con nombre. */}
        <fieldset className="m-0 grid min-w-0 border-0 p-0">
          <legend className="mb-1 min-w-0 p-0 text-sala-ink sala-type-label [overflow-wrap:anywhere]">
            {t('selectFriends')}
          </legend>
          {loadingFriends && (
            <p role="status" className="py-3 sala-type-text text-sala-ink-secondary">
              {t('loadingFriends')}
            </p>
          )}
          {!loadingFriends && friends.length === 0 && <p className="py-3 sala-type-text text-sala-ink-secondary">{t('noFriends')}</p>}
          {friends.map((f) => (
            <SalaCheckbox
              key={f.user.id}
              checked={selected.has(f.user.id)}
              onChange={() => toggleFriend(f.user.id)}
              label={
                <span className="inline-flex items-center gap-2">
                  {/* El nombre ya lo dice: las iniciales no se leen dos veces. */}
                  <span aria-hidden="true" className="-my-1 inline-flex">
                    <Avatar initials={f.user.avatar_initials} color={f.user.avatar_color} size="sm" />
                  </span>
                  {f.user.username}
                </span>
              }
            />
          ))}
        </fieldset>

        {friends.length > 0 && (
          <SalaTextarea
            label={t('message')}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('messagePlaceholder')}
            rows={2}
            maxLength={500}
            className="resize-none"
          />
        )}

        {/* Resultado del envío: región viva que existe desde que se abre. */}
        <p role="status" className={status === 'sent' ? 'sala-type-text font-semibold text-sala-ink' : 'sr-only'}>
          {status === 'sent' ? t('sent') : ''}
        </p>
      </div>
    </SalaDialog>
  )
}
