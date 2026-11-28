'use client'

// ============================================================
// KULTURA — /lists/[id] en «Sala» (fase 8.5 L3–L4, bandera SALA_LISTAS)
// La ficha de una lista para su dueño y sus miembros (a los demás la página
// los lleva a la pública, `/u/…/l/…`). Cabecera, títulos, ordenar y anotar
// (`SalaReorderableItems`) y miembros (`SalaListMembers`).
//
// - Cabecera: el nombre en el `h1`, los datos con palabras y en minúscula
//   («varios formatos · franquicia · colaborativa · 6 títulos») y, si no es
//   tuya, «de @…» con enlace a su perfil público. La descripción, y para el
//   dueño su editor. La visibilidad con `SalaRadioGroup` (cada opción con su
//   explicación) y «Compartir» si es pública. «Añadir título» lleva a
//   Descubrir con el formato de la lista.
// - Borrar: `SalaConfirmDialog` con «Eliminar lista» (antes «Confirmar») y
//   «Cancelar» primero; el error, dentro del diálogo.
// - Títulos: `h2` solo con «Títulos» (antes «Títulos2») y el número aparte,
//   anunciado al cambiar. Rejilla de `SalaWorkCard` en una lista ordenada;
//   en un ranking, el puesto a la vista y en el nombre de la tarjeta (no en
//   el póster de relleno); la nota en sus datos. «Quitar» va debajo de la
//   tarjeta, no encima del póster (en un móvil tapaba un tercio de la
//   portada). Quitar un título no pregunta: desaparece y un aviso ofrece
//   «Deshacer» (con el foco en él); si nadie deshace, se quita de verdad. Si
//   falla, vuelve a su sitio y se dice.
//
// Solo se carga con `next/dynamic` (`SalaListDetailLazy`).
// ============================================================

import '@/styles/sala/tokens.css'
import '@/styles/sala/fonts.css'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { SalaBlockState } from '@/components/sala/SalaBlockState'
import { SalaButton } from '@/components/sala/SalaButton'
import { SalaConfirmDialog } from '@/components/sala/SalaConfirmDialog'
import { SalaNotice } from '@/components/sala/SalaNotice'
import { SalaRadio, SalaRadioGroup } from '@/components/sala/SalaRadioGroup'
import { SalaTextarea } from '@/components/sala/SalaTextarea'
import { SalaToastProvider, useSalaToast, type SalaToastLabels } from '@/components/sala/SalaToast'
import { SalaWorkCard } from '@/components/sala/SalaWorkCard'
import { SalaWorkList } from '@/components/sala/SalaWorkList'
import { ShareLinkButton } from '@/components/social/ShareLinkButton'
import { removeListItem } from '@/lib/lists/client'
import { useListDetail } from '@/app/[locale]/(app)/lists/[id]/useListDetail'
import { useListDescription } from '@/app/[locale]/(app)/lists/[id]/useListDescription'
import {
  DESCRIPTION_MAX,
  canSeeListMembers,
  invitableFriends,
  publicListPath,
  type ListFriend,
} from '@/app/[locale]/(app)/lists/[id]/list-detail-utils'
import type { List, ListItem, ListMember } from '@/types/list'
import type { MediaType } from '@/types/media'
import { SalaListMembers } from './SalaListMembers'
import { SalaReorderableItems } from './SalaReorderableItems'

export interface SalaListDetailProps {
  list: List
  items: ListItem[]
  members: ListMember[]
  currentUserId: string
  currentUserFriends: ListFriend[]
  canEdit: boolean
  toastLabels: SalaToastLabels
}

export function SalaListDetail({ toastLabels, ...props }: SalaListDetailProps) {
  return (
    <SalaToastProvider labels={toastLabels}>
      <SalaListDetailView {...props} />
    </SalaToastProvider>
  )
}

/** La ficha de la obra de un título de la lista. */
function mediaHref(item: ListItem): string {
  const type = item.media?.type ?? item.mediaId.split('_')[0]
  return `/media/${type}/${item.mediaId.split('_').slice(1).join('_')}`
}

const REJILLA = 'grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'

function SalaListDetailView({
  list,
  items: initialItems,
  members: initialMembers,
  currentUserId,
  currentUserFriends,
  canEdit,
}: Omit<SalaListDetailProps, 'toastLabels'>) {
  const t = useTranslations('lists')
  const tType = useTranslations('discoverFilters.typeBadge')
  const tcol = useTranslations('collection')
  const tc = useTranslations('common')
  const locale = useLocale()
  const toast = useSalaToast()
  const detail = useListDetail({ list, initialItems, initialMembers, currentUserFriends })
  const description = useListDescription(list.id, list.description)
  const isOwner = list.ownerId === currentUserId
  const ranked = list.template === 'ranking'
  const itemsHeadingId = useId()
  const deleteRef = useRef<HTMLButtonElement>(null)
  const min = (s: string) => s.toLocaleLowerCase(locale)

  // Quitar con «Deshacer»: el título se esconde al momento y se quita de
  // verdad cuando el aviso se va sin deshacer (o al salir de la página).
  const [hidden, setHidden] = useState<Set<string>>(() => new Set())
  const pending = useRef(new Map<string, ListItem>())
  const { items, onItemsChange } = detail
  const itemsRef = useRef(items)
  itemsRef.current = items

  const commit = useCallback(
    async (item: ListItem) => {
      if (!pending.current.delete(item.id)) return
      try {
        await removeListItem(list.id, item.id)
        onItemsChange(itemsRef.current.filter((i) => i.id !== item.id))
      } catch {
        toast.showError(t('removeError'))
      } finally {
        setHidden((prev) => {
          const next = new Set(prev)
          next.delete(item.id)
          return next
        })
      }
    },
    [list.id, onItemsChange, t, toast]
  )

  useEffect(() => {
    const map = pending.current
    return () => {
      // Al salir con avisos aún abiertos: lo que no se deshizo, se quita.
      for (const item of map.values()) void removeListItem(list.id, item.id).catch(() => undefined)
      map.clear()
    }
  }, [list.id])

  function remove(item: ListItem) {
    const title = item.media?.title ?? item.mediaId
    pending.current.set(item.id, item)
    setHidden((prev) => new Set(prev).add(item.id))
    toast.show({
      message: t('sala.removed', { title }),
      action: {
        label: t('sala.undo'),
        autoFocus: true,
        onAction: () => {
          pending.current.delete(item.id)
          setHidden((prev) => {
            const next = new Set(prev)
            next.delete(item.id)
            return next
          })
        },
        onExpire: () => void commit(item),
        focusAfter: () => document.querySelector<HTMLElement>(`[data-sala-list-item="${item.id}"] a`),
      },
    })
  }

  const visible = useMemo(() => items.filter((i) => !hidden.has(i.id)), [items, hidden])
  const formato = min(list.mediaType === 'mixed' ? t('mediaTypeMixed') : tType(list.mediaType))
  const datos = [
    formato,
    list.template ? min(t(`template.${list.template}`)) : null,
    list.isCollaborative ? t('sala.collaborative') : null,
  ].filter((x): x is string => Boolean(x))
  const addHref = list.mediaType === 'mixed' ? '/discover' : `/discover?type=${list.mediaType}`
  const publicPath = publicListPath(list)
  const showMembers = list.isCollaborative && canSeeListMembers(list, detail.members, currentUserId)

  return (
    <main data-sala-list-detail="" className="page-grid [&>*]:max-w-6xl py-6 md:py-8 flex flex-col gap-10 font-sala-text text-sala-ink">
      <header className="flex flex-col gap-4">
        <h1 className="sala-type-heading [overflow-wrap:anywhere]">{list.name}</h1>
        <p className="sala-type-small text-sala-ink-secondary [overflow-wrap:anywhere]">
          {datos.map((d, i) => (
            <span key={d} className={i === 0 ? 'font-semibold text-sala-ink' : undefined}>
              {i > 0 ? <Sep /> : null}
              {d}
            </span>
          ))}
          {!isOwner && list.owner ? (
            <span>
              <Sep />
              <Link href={`/u/${list.owner.username}`} className="whitespace-nowrap text-sala-ink underline underline-offset-2 sala-focused:sala-focus">
                {t('sala.by', { username: list.owner.username })}
              </Link>
            </span>
          ) : null}
        </p>

        <SalaListDescription description={description} isOwner={isOwner} />

        {isOwner ? (
          <div className="flex flex-col gap-3">
            <SalaRadioGroup
              legend={tcol('visibility')}
              name="list-visibility"
              value={detail.isPublic ? 'public' : 'private'}
              onChange={detail.handleVisibilityChange}
            >
              <SalaRadio value="private" label={tcol('private')} hint={tcol('privateHint')} />
              <SalaRadio value="public" label={tcol('public')} hint={tcol('publicHint')} />
            </SalaRadioGroup>
            {detail.isPublic && publicPath ? (
              <div>
                <ShareLinkButton path={publicPath} title={list.name} label={tcol('share')} skin="sala" />
              </div>
            ) : null}
          </div>
        ) : null}

        {canEdit || isOwner ? (
          <div className="flex flex-wrap gap-3">
            {canEdit ? (
              <SalaButton asChild variant="primary">
                <Link href={addHref}>{t('addItem')}</Link>
              </SalaButton>
            ) : null}
            {isOwner ? (
              <SalaButton ref={deleteRef} variant="secondary" onClick={detail.openConfirmDelete}>
                {t('deleteList')}
              </SalaButton>
            ) : null}
          </div>
        ) : null}

        {detail.actionError ? <SalaNotice tone="error">{detail.actionError}</SalaNotice> : null}
      </header>

      <SalaConfirmDialog
        open={detail.confirmDelete}
        title={t('deleteListTitle')}
        message={t('deleteListConfirm')}
        confirmLabel={t('deleteList')}
        cancelLabel={tc('cancel')}
        danger
        loading={detail.deleting}
        error={detail.deleteError}
        finalFocusRef={deleteRef}
        onConfirm={detail.handleDeleteList}
        onCancel={detail.closeConfirmDelete}
      />

      <section aria-labelledby={itemsHeadingId} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 id={itemsHeadingId} className="sala-type-data">
              {t('itemsTitle')}
            </h2>
            {/* Región viva: al quitar o deshacer se anuncia cuántos quedan. */}
            <p role="status" data-sala-list-count="" className="sala-type-label tabular-nums text-sala-ink-secondary">
              {t('itemCount', { count: visible.length })}
            </p>
          </div>
          {canEdit && items.length > 0 ? (
            <SalaButton
              variant={detail.reordering ? 'primary' : 'secondary'}
              aria-pressed={detail.reordering}
              onClick={detail.toggleReordering}
            >
              {detail.reordering ? t('reorderDone') : t('reorder')}
            </SalaButton>
          ) : null}
        </div>

        {detail.reordering && canEdit && items.length > 0 ? (
          <SalaReorderableItems listId={list.id} items={visible} onItemsChange={onItemsChange} ranked={ranked} />
        ) : visible.length === 0 ? (
          <SalaBlockState
            headingLevel={3}
            title={t('noItems')}
            description={t('noItemsHint')}
            action={
              canEdit ? (
                <SalaButton asChild>
                  <Link href={addHref}>{t('noItemsDiscover')}</Link>
                </SalaButton>
              ) : undefined
            }
          />
        ) : (
          <SalaWorkList ordered aria-labelledby={itemsHeadingId} loadingLabel={tc('loading')} className={REJILLA}>
            {visible.map((item, index) => {
              const title = item.media?.title ?? item.mediaId
              const type = (item.media?.type ?? item.mediaId.split('_')[0]) as MediaType
              return (
                <div key={item.id} data-sala-list-item={item.id} className="flex flex-col items-start gap-1">
                  <SalaWorkCard
                    href={mediaHref(item)}
                    title={title}
                    rank={ranked ? index + 1 : undefined}
                    format={type}
                    formatLabel={tType(type)}
                    year={item.media?.year}
                    poster={item.media?.poster}
                    ratio="2/3"
                    headingLevel={3}
                    detail={item.note ? <span className="[overflow-wrap:anywhere]">{item.note}</span> : undefined}
                    className="w-full"
                  />
                  {canEdit ? (
                    <SalaButton
                      variant="quiet"
                      icon={<QuitarIcon />}
                      aria-label={t('removeItemNamed', { title })}
                      onClick={() => remove(item)}
                      className="-ms-6"
                    >
                      {t('sala.removeShort')}
                    </SalaButton>
                  ) : null}
                </div>
              )
            })}
          </SalaWorkList>
        )}
      </section>

      {/* Miembros: solo colaborativas, y solo para su dueño y sus miembros. */}
      {showMembers ? (
        <SalaListMembers
          list={list}
          members={detail.members}
          isOwner={isOwner}
          onRemoveMember={detail.removeMember}
          invitableFriends={invitableFriends(detail.members, list.ownerId, currentUserFriends)}
          inviteUserId={detail.inviteUserId}
          onInviteUserIdChange={detail.setInviteUserId}
          inviting={detail.inviting}
          onInvite={detail.handleInvite}
        />
      ) : null}
    </main>
  )
}

/** Separador de datos: un punto a la vista y una coma para el lector de pantalla. */
function Sep() {
  return (
    <>
      <span aria-hidden="true"> · </span>
      <span className="sr-only">, </span>
    </>
  )
}

function QuitarIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="square" aria-hidden="true" className="h-5 w-5">
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  )
}

/** La descripción y, para el dueño, su editor (el mismo estado que hoy). */
function SalaListDescription({
  description,
  isOwner,
}: {
  description: ReturnType<typeof useListDescription>
  isOwner: boolean
}) {
  const t = useTranslations('lists')
  const td = useTranslations('diary')
  const counter = (count: number, max: number) => td('chars', { count, max })

  if (isOwner && description.editing) {
    return (
      <form onSubmit={description.save} className="flex max-w-2xl flex-col gap-3">
        <SalaTextarea
          id={description.fieldId}
          label={t('descriptionLabel')}
          error={description.error ? t('descriptionError') : undefined}
          autoFocus
          value={description.draft}
          onChange={(e) => description.setDraft(e.target.value)}
          maxLength={DESCRIPTION_MAX}
          rows={3}
          placeholder={t('descriptionPlaceholder')}
          counter={counter}
        />
        <div className="flex flex-wrap gap-3">
          <SalaButton type="button" variant="quiet" onClick={description.cancelEditing} disabled={description.saving}>
            {t('cancel')}
          </SalaButton>
          <SalaButton type="submit" loading={description.saving} loadingLabel={t('sala.savingDescription')}>
            {t('descriptionSave')}
          </SalaButton>
        </div>
      </form>
    )
  }

  return (
    <>
      {description.description ? (
        <p className="max-w-2xl whitespace-pre-line sala-type-text text-sala-ink [overflow-wrap:anywhere]">{description.description}</p>
      ) : null}
      {isOwner ? (
        <div>
          <SalaButton variant="quiet" onClick={description.startEditing} className="-ms-6">
            {description.description ? t('editDescription') : t('addDescription')}
          </SalaButton>
        </div>
      ) : null}
    </>
  )
}
