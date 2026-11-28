'use client'

// ============================================================
// KULTURA — Miembros de una lista colaborativa en «Sala» (fase 8.5 L4)
// Solo la ven su dueño y sus miembros (lo decide `SalaListDetail`).
//
// - `h2` «Miembros» y una fila por persona: avatar, nombre con enlace a su
//   perfil y «Propietario» para el dueño.
// - El dueño quita a alguien con «Quitar a @nombre» (el botón dice a quién)
//   y un `SalaConfirmDialog` que también lo dice; el error va dentro del
//   diálogo y el foco vuelve a «Miembros» al quitar (el botón ya no existe)
//   o al botón si se cancela.
// - Invitar: `SalaSelect` con su etiqueta a la vista y «Invitar».
// ============================================================

import { useId, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Avatar } from '@/components/ui/Avatar'
import { SalaButton } from '@/components/sala/SalaButton'
import { SalaConfirmDialog } from '@/components/sala/SalaConfirmDialog'
import { SalaLink } from '@/components/sala/SalaLink'
import { SalaSelect } from '@/components/sala/SalaSelect'
import type { List, ListMember } from '@/types/list'
import type { ListFriend } from '@/app/[locale]/(app)/lists/[id]/list-detail-utils'

interface SalaListMembersProps {
  list: Pick<List, 'id' | 'owner'>
  members: ListMember[]
  isOwner: boolean
  /** Quita al miembro; `false` si falla (lo dice el diálogo). */
  onRemoveMember: (userId: string) => Promise<boolean>
  invitableFriends: ListFriend[]
  inviteUserId: string
  onInviteUserIdChange: (userId: string) => void
  inviting: boolean
  onInvite: () => void
}

export function SalaListMembers({
  list,
  members,
  isOwner,
  onRemoveMember,
  invitableFriends,
  inviteUserId,
  onInviteUserIdChange,
  inviting,
  onInvite,
}: SalaListMembersProps) {
  const t = useTranslations('lists')
  const tc = useTranslations('common')
  const titleId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>())
  const [removing, setRemoving] = useState<ListMember | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A dónde vuelve el foco al cerrar: al botón si se cancela; a «Miembros» si se quitó.
  const finalFocusRef = useRef<HTMLElement | null>(null)

  function ask(member: ListMember) {
    setError(null)
    finalFocusRef.current = buttonRefs.current.get(member.userId) ?? null
    setRemoving(member)
  }

  async function confirm() {
    if (!removing) return
    setBusy(true)
    setError(null)
    const ok = await onRemoveMember(removing.userId)
    setBusy(false)
    if (ok) {
      finalFocusRef.current = headingRef.current
      setRemoving(null)
    } else {
      setError(t('removeMemberError'))
    }
  }

  const name = removing?.user?.username ?? ''

  return (
    <section aria-labelledby={titleId} data-sala-list-members="" className="flex flex-col gap-4">
      <h2 id={titleId} ref={headingRef} tabIndex={-1} className="sala-type-data outline-none">
        {t('membersTitle')}
      </h2>
      <ul role="list" aria-labelledby={titleId} className="flex list-none flex-col gap-1">
        {list.owner ? (
          <li className="flex min-h-sala-target items-center gap-3 bg-sala-panel px-4 py-3">
            <Avatar initials={list.owner.avatarInitials} color={list.owner.avatarColor} size="sm" className="shrink-0" />
            <p className="min-w-0 flex-1 sala-type-text [overflow-wrap:anywhere]">
              <SalaLink href={`/profile/${list.owner.username}`} className="font-semibold">
                @{list.owner.username}
              </SalaLink>{' '}
              <span className="sala-type-small text-sala-ink-secondary">{t('owner')}</span>
            </p>
          </li>
        ) : null}
        {members.map((m) =>
          m.user ? (
            <li key={m.userId} className="flex flex-wrap items-center gap-3 bg-sala-panel px-4 py-3">
              <Avatar initials={m.user.avatarInitials} color={m.user.avatarColor} size="sm" className="shrink-0" />
              <p className="min-w-0 flex-1 sala-type-text [overflow-wrap:anywhere]">
                <SalaLink href={`/profile/${m.user.username}`} className="font-semibold">
                  @{m.user.username}
                </SalaLink>
              </p>
              {isOwner ? (
                <SalaButton
                  ref={(el) => {
                    if (el) buttonRefs.current.set(m.userId, el)
                    else buttonRefs.current.delete(m.userId)
                  }}
                  variant="secondary"
                  onClick={() => ask(m)}
                >
                  {t('sala.removeMemberNamed', { username: m.user.username })}
                </SalaButton>
              ) : null}
            </li>
          ) : null
        )}
      </ul>

      {isOwner && invitableFriends.length > 0 ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            onInvite()
          }}
        >
          <SalaSelect
            id={`invite-${list.id}`}
            label={t('inviteMember')}
            value={inviteUserId}
            onChange={(e) => onInviteUserIdChange(e.target.value)}
            fieldClassName="min-w-0 flex-1 basis-56"
          >
            <option value="">{t('selectFriend')}</option>
            {invitableFriends.map((f) => (
              <option key={f.id} value={f.id}>
                {f.username}
              </option>
            ))}
          </SalaSelect>
          <SalaButton type="submit" loading={inviting} loadingLabel={t('sala.inviting')} disabled={!inviteUserId}>
            {t('invite')}
          </SalaButton>
        </form>
      ) : null}

      <SalaConfirmDialog
        open={removing !== null}
        title={t('sala.removeMemberTitle', { username: name })}
        message={t('sala.removeMemberMessage', { username: name })}
        confirmLabel={t('sala.removeMemberNamed', { username: name })}
        cancelLabel={tc('cancel')}
        danger
        loading={busy}
        loadingLabel={t('sala.removingMember')}
        error={error}
        finalFocusRef={finalFocusRef}
        onConfirm={() => void confirm()}
        onCancel={() => setRemoving(null)}
      />
    </section>
  )
}
