'use client'

// ============================================================
// KULTURA — SalaLibraryAction (fase 8.5, ficha con `SALA_FICHA`)
// Las acciones de biblioteca de la ficha en «Sala»: añadir, actualizar
// (estado, nota, progreso, diario) y quitar con «Deshacer». El
// comportamiento es el de `LibraryAction` (`useLibraryAction`: mismas server
// actions, mismas cachés, mismo borrado diferido); aquí solo cambia la vista:
//
// - `SalaButton` de 48 px; «Eliminar» en `quiet` (no compite con
//   «Actualizar») y la confirmación en `SalaConfirmDialog` con el botón
//   `danger`, cuyo texto dice lo que se pierde.
// - Los avisos van por `SalaToastProvider` (regiones vivas: `status` para lo
//   que sale bien, `assertive` para los errores). El «Deshacer» recibe el foco
//   al cerrarse la confirmación (el botón que la abrió ya no existe).
// - El estado se dice en texto («Estado: Completado»), nunca solo con color.
// - Sello de «Visto»: la columna ya no lleva póster, así que cuelga de la
//   caja del estado, plano y del acento de la obra. Decorativo (el aviso ya
//   dice «Guardado»), sin ocupar sitio y sin nada con movimiento reducido.
// - Diálogos con la paleta de la obra: cuelgan de `<body>`, fuera del
//   contenedor `sala-work`, así que se la llevan al abrirse.
// ============================================================

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { SalaButton } from '@/components/sala/SalaButton'
import { SalaConfirmDialog } from '@/components/sala/SalaConfirmDialog'
import { SalaToastProvider, useSalaToast, type SalaToastLabels } from '@/components/sala/SalaToast'
import { SalaLibraryDialog } from '@/components/library/sala/SalaLibraryDialog'
import { useLibraryAction, type LibraryMediaCache } from '@/components/library/useLibraryAction'
import { playSalaStamp } from '@/lib/library/motion'
import { SALA_WORK_CLASS, paletteFromElement } from '@/lib/design/sala-palette'
import type { ImagePalette } from '@/lib/design/image-palette'
import type { LibraryEntry } from '@/types/library'

interface SalaLibraryActionProps {
  mediaId: string
  mediaCache: LibraryMediaCache
  initialEntry: LibraryEntry | null
  /** Textos de la zona de avisos, ya traducidos. */
  toastLabels: SalaToastLabels
}

export function SalaLibraryAction({ toastLabels, ...props }: SalaLibraryActionProps) {
  return (
    <SalaToastProvider labels={toastLabels}>
      <SalaLibraryActionView {...props} />
    </SalaToastProvider>
  )
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" className="h-5 w-5">
      <path d="M10 4v12M4 10h12" />
    </svg>
  )
}

function SalaLibraryActionView({ mediaId, mediaCache, initialEntry }: Omit<SalaLibraryActionProps, 'toastLabels'>) {
  const t = useTranslations('library')
  const td = useTranslations('diary')
  const tc = useTranslations('common')
  const toast = useSalaToast()
  const {
    entry,
    modalOpen,
    openModal,
    closeModal,
    confirmRemove,
    openConfirmRemove,
    cancelRemove,
    loading,
    saveError,
    removeError,
    diary,
    progressConfig,
    stamp,
    prefetch,
    handleSave,
    handleDeleteLog,
    handleRemove,
    removeMessage,
    addRef,
    updateRef,
    stampRef,
    afterRemoveFocus,
  } = useLibraryAction({
    mediaId,
    mediaCache,
    initialEntry,
    isAuthenticated: true,
    toast,
    undoSelector: '[data-sala-toast-action]',
    playStamp: playSalaStamp,
  })

  // La paleta de la obra, leída del contenedor al abrir un diálogo.
  const rootRef = useRef<HTMLDivElement>(null)
  const [palette, setPalette] = useState<ImagePalette | undefined>(undefined)
  const readPalette = () => setPalette(paletteFromElement(rootRef.current?.closest<HTMLElement>(`.${SALA_WORK_CLASS}`)))

  function open() {
    readPalette()
    openModal()
  }

  function askRemove() {
    readPalette()
    openConfirmRemove()
  }

  return (
    <div ref={rootRef} data-sala-library="" className="flex flex-wrap items-center gap-x-4 gap-y-3">
      {entry ? (
        <>
          <p className="relative inline-flex min-h-sala-target flex-col justify-center bg-sala-panel px-4 py-1.5">
            <span className="sala-type-small text-sala-ink-secondary">{t('statusLabel')}</span>
            <span className="sala-type-data text-sala-ink" data-testid="sala-library-status">
              {t(`status.${entry.status}`)}
            </span>
            {/* Sello de «Visto»: cuelga de la esquina de la caja del estado. */}
            {stamp > 0 && (
              <span
                ref={stampRef}
                aria-hidden="true"
                data-testid="library-stamp"
                className="pointer-events-none absolute -right-3 -top-4 z-10 whitespace-nowrap bg-sala-accent px-3 py-1 sala-type-label text-sala-accent-ink opacity-0"
              >
                {td('stamp', { type: mediaCache.type })}
              </span>
            )}
          </p>
          <SalaButton ref={updateRef} variant="secondary" onClick={open} onPointerEnter={prefetch} onFocus={prefetch}>
            {t('updateEntry')}
          </SalaButton>
          <SalaButton variant="quiet" onClick={askRemove} onPointerEnter={prefetch} onFocus={prefetch} disabled={loading}>
            {t('remove')}
          </SalaButton>
        </>
      ) : (
        <SalaButton
          ref={addRef}
          variant="primary"
          icon={<PlusIcon />}
          onClick={open}
          onPointerEnter={prefetch}
          onFocus={prefetch}
        >
          {t('addToLibrary')}
        </SalaButton>
      )}

      <SalaLibraryDialog
        open={modalOpen}
        current={entry}
        mediaType={mediaCache.type}
        onSave={handleSave}
        onClose={closeModal}
        loading={loading}
        finalFocusRef={entry ? undefined : updateRef}
        error={saveError}
        diary={diary}
        onDeleteLog={handleDeleteLog}
        title={mediaCache.title}
        progressConfig={progressConfig}
        palette={palette}
      />

      {/* ACC-11: quitar borra estado, nota y progreso (y el diario); se confirma antes. */}
      <SalaConfirmDialog
        open={confirmRemove}
        title={t('removeConfirmTitle')}
        message={removeMessage}
        confirmLabel={t('removeConfirm')}
        cancelLabel={tc('cancel')}
        danger
        loading={loading}
        loadingLabel={t('saving')}
        onConfirm={handleRemove}
        onCancel={cancelRemove}
        finalFocusRef={afterRemoveFocus}
        error={removeError}
        palette={palette}
      />
    </div>
  )
}
