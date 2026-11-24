'use client'

// ============================================================
// KULTURA — Cambiar estado y nota desde la Biblioteca (fase 8.2,
// bandera LIBRARY_QUICK_EDIT)
// Botón sobre la portada de cada tarjeta de la Biblioteca, FUERA de su enlace,
// que abre el mismo diálogo de la ficha (`LibraryStatusModal`) sin entrar en
// ella. El comportamiento (qué se pide antes de abrir, qué se guarda, qué se
// avisa) es `useLibraryQuickEdit`, el mismo que usa «Sala» (fase 8.5 B1).
// ============================================================

import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import { LibraryStatusModal } from '@/components/library/LibraryStatusModal'
import { useLibraryQuickEdit } from '@/components/library/useLibraryQuickEdit'
import { useToastContext } from '@/components/ui/ToastProvider'
import { IconMore } from '@/components/icons'
import { cn } from '@/lib/utils/index'
import type { LibraryEntry } from '@/types/library'

export interface LibraryQuickEditProps {
  entry: LibraryEntry
  title: string
  /** La entrada tal como quedó guardada. */
  onSaved: (entry: LibraryEntry) => void
  className?: string
}

export function LibraryQuickEdit({ entry, title, onSaved, className }: LibraryQuickEditProps) {
  const t = useTranslations('library')
  const toast = useToastContext()
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
      <button
        ref={buttonRef}
        type="button"
        onClick={openModal}
        aria-label={t('quickEdit', { title })}
        aria-haspopup="dialog"
        aria-disabled={opening}
        data-testid="library-quick-edit"
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-full border border-surface-border bg-surface-base/80 text-text-primary backdrop-blur-sm transition-colors',
          'hover:bg-surface-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-info',
          opening && 'opacity-60',
          className
        )}
      >
        <IconMore className="h-5 w-5" aria-hidden="true" />
      </button>
      {open && (
        <LibraryStatusModal
          current={entry}
          mediaType={mediaType}
          onSave={handleSave}
          onClose={closeModal}
          loading={saving}
          finalFocusRef={buttonRef}
          error={saveError}
          diary={diary}
          onDeleteLog={handleDeleteLog}
          title={title}
          progressConfig={progressConfig}
        />
      )}
    </>
  )
}
