'use client'

// ============================================================
// KULTURA — SalaAddToListDialog (fase 8.5, F2d, ficha con `SALA_FICHA`)
// La vista en «Sala» del diálogo de «Añadir a lista». El estado (cargar las
// listas, elegir, añadir, errores) sigue en `AddToListButton`: aquí solo se
// pinta, con `SalaDialog` (hoja en móvil), `SalaRadioGroup` y `SalaButton`.
// Llega por next/dynamic (`SalaSocialDialogsLazy`): la ficha de hoy no lo
// descarga.
//
// Foco: al abrir, las listas aún están cargando (el diálogo lo da por hecho
// desde que se abre) y el foco cae en «Cancelar».
// Cuando llegan, pasa a la primera lista, salvo que mientras tanto la persona
// haya pulsado una tecla o el puntero (decisión de Víctor, F2d).
// ============================================================

import { useEffect, useRef, type RefObject } from 'react'
import { useTranslations } from 'next-intl'
import { SalaDialog } from '@/components/sala/SalaDialog'
import { SalaButton } from '@/components/sala/SalaButton'
import { SalaLink } from '@/components/sala/SalaLink'
import { SalaRadio, SalaRadioGroup } from '@/components/sala/SalaRadioGroup'
import { useWorkPalette } from './useWorkPalette'

export interface SalaAddToListDialogProps {
  open: boolean
  onClose: () => void
  /** El botón que lo abre: de su obra sale la paleta. */
  anchorRef?: RefObject<HTMLElement | null>
  loading: boolean
  fetchError: boolean
  /** Hay listas, aunque ninguna sea de este formato. */
  hasLists: boolean
  lists: { id: string; name: string }[]
  selectedListId: string
  onSelect: (id: string) => void
  adding: boolean
  addError: string | null
  onAdd: () => void
}

export function SalaAddToListDialog({
  open,
  onClose,
  anchorRef,
  loading: loadingProp,
  fetchError,
  hasLists,
  lists,
  selectedListId,
  onSelect,
  adding,
  addError,
  onAdd,
}: SalaAddToListDialogProps) {
  const t = useTranslations('lists')
  const tc = useTranslations('common')
  const palette = useWorkPalette(anchorRef, open)
  // Abierto pero sin haber empezado a cargar (el botón pide las listas en un
  // efecto, después del primer pintado): también es «cargando». Si no, el
  // primer fotograma diría «No tienes listas» y su enlace se llevaría el foco.
  // Va aquí y no en el botón para que el botón, que se comparte con la ficha
  // de hoy, no cambie.
  const started = useRef(false)
  if (!open) started.current = false
  else if (loadingProp) started.current = true
  const loading = loadingProp || (open && !started.current)
  const ready = !loading && !fetchError
  const canAdd = ready && lists.length > 0
  const empty = ready && lists.length === 0

  // ¿La persona ha tocado algo (tecla o puntero) mientras cargaban las listas?
  // Entonces el foco es suyo y no se mueve.
  const touched = useRef(false)
  const firstListRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!open || !loading) return
    touched.current = false
    const mark = () => {
      touched.current = true
    }
    document.addEventListener('keydown', mark, true)
    document.addEventListener('pointerdown', mark, true)
    return () => {
      document.removeEventListener('keydown', mark, true)
      document.removeEventListener('pointerdown', mark, true)
    }
  }, [open, loading])
  useEffect(() => {
    if (canAdd && !touched.current) firstListRef.current?.focus()
  }, [canAdd])

  return (
    <SalaDialog
      open={open}
      onClose={onClose}
      variant="sheet"
      title={t('addToListTitle')}
      closeLabel={tc('close')}
      dismissible={!adding}
      // Sin las listas no hay nada que elegir: el fallo al cargarlas también se anuncia aquí.
      error={fetchError ? t('errorAdding') : addError}
      palette={palette}
      footer={
        <>
          <SalaButton variant={canAdd ? 'quiet' : 'secondary'} onClick={onClose} disabled={adding}>
            {t('cancel')}
          </SalaButton>
          {canAdd && (
            <SalaButton variant="primary" loading={adding} loadingLabel={tc('loading')} disabled={!selectedListId} onClick={onAdd}>
              {t('addButton')}
            </SalaButton>
          )}
        </>
      }
    >
      {loading && (
        <p role="status" className="sala-type-text text-sala-ink-secondary">
          {tc('loading')}
        </p>
      )}

      {empty && (
        <div className="flex flex-col items-start gap-3">
          <p className="sala-type-text text-sala-ink-secondary">{hasLists ? t('noCompatibleLists') : t('noListsAtAll')}</p>
          <SalaLink variant="standalone" href="/lists" onClick={onClose}>
            {t('createListCta')}
          </SalaLink>
        </div>
      )}

      {canAdd && (
        <SalaRadioGroup legend={t('selectList')} name="list-select" value={selectedListId} onChange={onSelect}>
          {lists.map((l, i) => (
            <SalaRadio key={l.id} ref={i === 0 ? firstListRef : undefined} value={l.id} label={l.name} />
          ))}
        </SalaRadioGroup>
      )}
    </SalaDialog>
  )
}
