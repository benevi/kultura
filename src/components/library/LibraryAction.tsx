'use client'

// ============================================================
// KULTURA — LibraryAction
// CTA para añadir / actualizar / eliminar un título de la
// biblioteca personal del usuario desde la página de detalle.
//
// F-24: al abrir el diálogo pide la escala y el diario del título
// (/api/library/diary; se adelanta al pasar el ratón o el foco por el botón y
// se recuerda mientras dure la página). Al marcarlo como completado, el estado
// hace un «sello» lima (DIS-14, ≤ 300 ms, sin mover nada, nada con
// movimiento reducido) que cuelga del póster de la ficha (`data-library-stamp`)
// o, si no lo hay, de la etiqueta de estado.
//
// Quitar con «Deshacer»: el título desaparece al momento, pero el DELETE real
// espera a que se vaya el aviso (`onExpire`). El borrado se lleva por la FK
// (ON DELETE CASCADE) el diario del título —reseñas y notas privadas— y eso
// no se puede volver a crear: por eso «Deshacer» CANCELA el borrado en vez de
// volver a guardar la entrada. Si la página se cierra antes, se borra ya
// (`keepalive`); si se vuelve a añadir antes, el borrado pendiente se anula.
//
// F-27: a la vez se pide el progreso del título y lo que dice el proveedor
// (/api/library/progress: temporadas, capítulos, páginas, horas medias) para
// el control de progreso por formato del diálogo.
// ============================================================

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { KButton } from '@/components/ui/KButton'
import { LibraryStatusModal } from '@/components/library/LibraryStatusModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToastContext } from '@/components/ui/ToastProvider'
import { useLibraryAction, type LibraryMediaCache } from '@/components/library/useLibraryAction'
import { playStamp } from '@/lib/library/motion'
import { cn } from '@/lib/utils/index'
import type { LibraryEntry, LibraryStatus } from '@/types/library'

/** Solo para tests. */
export { __resetDiaryCache } from '@/components/library/useLibraryAction'

interface LibraryActionProps {
  mediaId: string
  mediaCache: LibraryMediaCache
  initialEntry: LibraryEntry | null
  isAuthenticated: boolean
}

const statusClasses: Record<LibraryStatus, string> = {
  completed: 'bg-accent-positive/20 text-accent-positive',
  // Texto claro sobre el azul: el azul sobre azul al 20 % daba < 4,5:1 (F-30).
  in_progress: 'bg-accent-info/20 text-text-primary',
  pending: 'bg-accent-highlight/20 text-accent-highlight',
  abandoned: 'bg-accent-danger/20 text-accent-danger',
}

export function LibraryAction({
  mediaId,
  mediaCache,
  initialEntry,
  isAuthenticated,
}: LibraryActionProps) {
  const t = useTranslations('library')
  const td = useTranslations('diary')
  const tc = useTranslations('common')
  const toast = useToastContext()
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
    isAuthenticated,
    toast,
    undoSelector: '[data-toast-action]',
    playStamp,
  })
  // El póster de la ficha, si lo hay: el sello se pinta colgado de él.
  const [posterAnchor, setPosterAnchor] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setPosterAnchor(document.querySelector<HTMLElement>('[data-library-stamp]'))
  }, [])

  function stampBadge(position: string) {
    return (
      <span
        ref={stampRef}
        aria-hidden="true"
        data-testid="library-stamp"
        className={cn(
          'pointer-events-none z-10 whitespace-nowrap rounded-full bg-accent-lime px-3 py-1 text-xs font-extrabold text-on-accent-lime opacity-0 shadow-sticker',
          position
        )}
      >
        {td('stamp', { type: mediaCache.type })}
      </span>
    )
  }

  if (!isAuthenticated) {
    return (
      <KButton asChild variant="primary">
        <Link href="/login">{t('signInToSave')}</Link>
      </KButton>
    )
  }

  const modal = modalOpen ? (
    <LibraryStatusModal
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
    />
  ) : null

  if (!entry) {
    return (
      <>
        <KButton
          ref={addRef}
          variant="primary"
          onClick={openModal}
          onPointerEnter={prefetch}
          onFocus={prefetch}
        >
          <span aria-hidden="true">+</span> {t('addToLibrary')}
        </KButton>
        {modal}
      </>
    )
  }

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="relative inline-flex">
          <span
            className={cn(
              'px-3 py-1 rounded-pill text-sm font-body font-medium',
              statusClasses[entry.status]
            )}
          >
            {t(`status.${entry.status}`)}
          </span>
          {/* DIS-14: «badge colgante» del sistema de diseño (lima, −8°, sombra dura);
              decorativa. Cuelga del póster de la ficha si lo hay. */}
          {stamp > 0 && !posterAnchor && stampBadge('absolute -top-4 -right-6')}
          {stamp > 0 && posterAnchor && createPortal(stampBadge('absolute -top-3.5 -left-3.5 text-sm'), posterAnchor)}
        </span>
        <KButton
          ref={updateRef}
          variant="secondary"
          size="sm"
          onClick={openModal}
          onPointerEnter={prefetch}
          onFocus={prefetch}
        >
          {t('updateEntry')}
        </KButton>
        <KButton
          variant="secondary"
          size="sm"
          onClick={openConfirmRemove}
          onPointerEnter={prefetch}
          onFocus={prefetch}
          disabled={loading}
          className="text-accent-danger hover:text-accent-danger border-accent-danger/30 hover:border-accent-danger/60"
        >
          {t('removeConfirm')}
        </KButton>
      </div>

      {modal}

      {/* ACC-11: quitar borra estado, nota y progreso (y el diario); se confirma antes. */}
      <ConfirmModal
        isOpen={confirmRemove}
        title={t('removeConfirmTitle')}
        message={removeMessage}
        confirmLabel={t('removeConfirm')}
        cancelLabel={tc('cancel')}
        isDestructive
        loading={loading}
        onConfirm={handleRemove}
        onCancel={cancelRemove}
        finalFocusRef={afterRemoveFocus}
        error={removeError}
      />
    </>
  )
}
