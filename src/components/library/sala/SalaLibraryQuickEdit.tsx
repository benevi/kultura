'use client'

// ============================================================
// KULTURA — SalaLibraryQuickEdit (fase 8.5 B1, bandera SALA_BIBLIOTECA)
// Cambiar estado y nota desde una tarjeta de la Biblioteca en «Sala»: un
// `SalaButton` de solo icono, fuera del enlace de la tarjeta, que abre el
// diálogo de biblioteca de la ficha (`SalaLibraryDialog`). El comportamiento
// es el de la biblioteca de hoy (`useLibraryQuickEdit`); los avisos van por
// el `SalaToastProvider` de la rejilla.
//
// - Mientras se piden la escala y el progreso del título, el botón «carga»
//   (no se puede volver a pulsar y se anuncia); al llegar, se abre el diálogo
//   con el foco en «Estado».
// - Al cerrar, el foco vuelve al botón; si la tarjeta ya no está (el filtro
//   de estado la ha sacado), a `fallbackFocusRef` (la lista).
// ============================================================

import { useRef, type RefObject } from 'react'
import { useTranslations } from 'next-intl'
import { SalaButton } from '@/components/sala/SalaButton'
import { useSalaToast } from '@/components/sala/SalaToast'
import { SalaLibraryDialog } from '@/components/library/sala/SalaLibraryDialog'
import { useLibraryQuickEdit } from '@/components/library/useLibraryQuickEdit'
import type { LibraryEntry } from '@/types/library'

export interface SalaLibraryQuickEditProps {
  entry: LibraryEntry
  title: string
  /** La entrada tal como quedó guardada. */
  onSaved: (entry: LibraryEntry) => void
  /** A dónde va el foco al cerrar si el botón ya no existe. */
  fallbackFocusRef?: RefObject<HTMLElement | null>
}

/**
 * Lápiz de trazo recto (biblia §1: esquinas rectas, sin adornos). El
 * `viewBox` lleva margen: en la caja de 20 px del botón se ve de unos 16.
 */
function PencilIcon() {
  return (
    <svg aria-hidden="true" viewBox="-2 -2 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" className="h-5 w-5">
      <path d="M13.5 3.5l3 3L7 16H4v-3l9.5-9.5zM11.5 5.5l3 3" />
    </svg>
  )
}

/**
 * Discreto sobre la portada (decisión de Víctor, #291): fondo de «Sala» al
 * 75 % con desenfoque y el lápiz en tinta. Sobre la portada más clara el
 * fondo mezclado no pasa de #5c5c5b y la tinta guarda más de 5:1 con él
 * (1.4.11 pide 3:1). Al pasar el puntero o con el foco del teclado se
 * resalta: tinta opaca, como el resto de botones de «Sala», y el anillo de
 * foco. Sigue midiendo 48 × 48 (2.5.8 pide 24).
 */
const DISCRETO = [
  "bg-[color-mix(in_srgb,var(--sala-background)_75%,transparent)] backdrop-blur-sm",
  "sala-focused:border-sala-ink sala-focused:bg-sala-ink sala-focused:text-sala-background",
].join(" ")

export function SalaLibraryQuickEdit({ entry, title, onSaved, fallbackFocusRef }: SalaLibraryQuickEditProps) {
  const t = useTranslations('library')
  const tc = useTranslations('common')
  const toast = useSalaToast()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const {
    mediaType,
    opening,
    open,
    openModal,
    closeModal,
    saving,
    saveError,
    diary,
    progressConfig,
    handleSave,
    handleDeleteLog,
  } = useLibraryQuickEdit({ entry, title, onSaved, toast })

  return (
    <>
      <SalaButton
        ref={buttonRef}
        variant="quiet"
        className={DISCRETO}
        icon={<PencilIcon />}
        label={t('quickEdit', { title })}
        aria-haspopup="dialog"
        onClick={openModal}
        loading={opening}
        loadingLabel={tc('loading')}
        data-testid="sala-library-quick-edit"
      />
      <SalaLibraryDialog
        open={open}
        current={entry}
        mediaType={mediaType}
        onSave={handleSave}
        onClose={closeModal}
        loading={saving}
        finalFocusRef={fallbackFocusRef}
        error={saveError}
        diary={diary}
        onDeleteLog={handleDeleteLog}
        title={title}
        progressConfig={progressConfig}
      />
    </>
  )
}
