// ============================================================
// KULTURA — /lists/[id]: estado y guardado de la descripción.
// Los `useId` se llaman desde la fibra de ListDetail, en el mismo orden que antes.
// ============================================================

import { useId, useState } from 'react'
import { createLogger } from '@/lib/logger'
import { updateList } from '@/lib/lists/client'

const log = createLogger('ListDetail')

export function useListDescription(listId: string, initial: string | null | undefined) {
  const [description, setDescription] = useState(initial ?? '')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const fieldId = useId()
  const hintId = useId()

  function startEditing() {
    setDraft(description)
    setError(false)
    setEditing(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(false)
    try {
      await updateList(listId, { description: draft })
      setDescription(draft.trim())
      setEditing(false)
    } catch (err) {
      log.error('description save failed', { message: err instanceof Error ? err.message : String(err) })
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  return {
    description,
    editing,
    draft,
    setDraft,
    saving,
    error,
    fieldId,
    hintId,
    startEditing,
    cancelEditing: () => setEditing(false),
    save,
  }
}

export type ListDescriptionState = ReturnType<typeof useListDescription>
