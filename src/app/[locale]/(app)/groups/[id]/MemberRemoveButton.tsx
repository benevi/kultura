'use client'

// ============================================================
// KULTURA — Expulsar a un miembro del grupo (F-11, solo el dueño)
// ============================================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { InlineConfirm, useRestoreFocus } from '@/components/social/ReportButton'
import { removeGroupMember } from '@/lib/social/actions'

interface Props {
  groupId: string
  userId: string
  username: string
}

export function MemberRemoveButton({ groupId, userId, username }: Props) {
  const t = useTranslations('moderation')
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const { ref: triggerRef, restore } = useRestoreFocus()

  async function handleRemove() {
    setBusy(true)
    setError(null)
    try {
      await removeGroupMember(groupId, userId)
      setDone(true)
      router.refresh()
    } catch {
      setError(t('removeMemberError'))
      setBusy(false)
    }
  }

  if (done) {
    return <p role="status" className="text-xs text-text-secondary">{t('memberRemoved', { username })}</p>
  }

  if (confirming) {
    return (
      <InlineConfirm
        className="mt-2"
        title={t('removeMemberConfirmTitle', { username })}
        body={t('removeMemberConfirmBody')}
        confirmLabel={t('removeMember')}
        cancelLabel={t('cancel')}
        loading={busy}
        error={error}
        onConfirm={handleRemove}
        onCancel={() => {
          setConfirming(false)
          setError(null)
          restore()
        }}
      />
    )
  }

  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={() => setConfirming(true)}
      aria-label={t('removeMemberNamed', { username })}
      className="min-h-11 px-3 rounded-full text-xs font-bold text-text-tertiary hover:text-accent-danger hover:bg-surface-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink"
    >
      {t('removeMember')}
    </button>
  )
}
