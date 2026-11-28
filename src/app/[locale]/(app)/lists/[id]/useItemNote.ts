'use client'

// ============================================================
// KULTURA — Nota de un título dentro de una lista: estado y guardado
// (F-25, PRO-10). Lo comparten `ItemNote` y la vista de «Sala»
// (`SalaItemNote`, fase 8.5 L4). Un campo vacío quita la nota; si falla, el
// texto escrito no se pierde y el foco vuelve al campo.
// ============================================================

import { useRef, useState } from 'react'
import type { ListItem } from '@/types/list'
import { setListItemNote } from '@/lib/lists/client'

export const NOTE_MAX = 500

export function useItemNote(listId: string, item: ListItem, onSaved: (note: string | null) => void) {
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  function open() {
    setDraft(item.note ?? '')
    setError(false)
    setEditing(true)
    requestAnimationFrame(() => fieldRef.current?.focus())
  }

  function close() {
    setEditing(false)
    requestAnimationFrame(() => toggleRef.current?.focus())
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(false)
    try {
      const data = await setListItemNote(listId, item.id, draft)
      onSaved(data.note)
      close()
    } catch {
      setError(true)
      fieldRef.current?.focus()
    } finally {
      setSaving(false)
    }
  }

  /** Escape en el campo cierra sin guardar (y no cierra lo que haya debajo). */
  function onFieldKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
    }
  }

  return { fieldRef, toggleRef, editing, draft, setDraft, saving, error, open, close, save, onFieldKeyDown }
}
