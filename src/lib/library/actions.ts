// ============================================================
// KULTURA — Library Actions (cliente)
// Helpers que hacen fetch al Route Handler /api/library.
// Uso exclusivo en Client Components.
// ============================================================

import type { LibraryEntry, LibraryPayload } from '@/types/library'

/** Añade un título a la biblioteca del usuario autenticado */
export async function addToLibrary(payload: LibraryPayload): Promise<LibraryEntry> {
  const response = await fetch('/api/library', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(data.error ?? 'Failed to add to library')
  }

  const data = await response.json() as { entry: LibraryEntry }
  return data.entry
}

/** Actualiza una entrada existente en la biblioteca del usuario autenticado */
export async function updateLibrary(payload: LibraryPayload): Promise<LibraryEntry> {
  const response = await fetch('/api/library', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(data.error ?? 'Failed to update library entry')
  }

  const data = await response.json() as { entry: LibraryEntry }
  return data.entry
}

/** Elimina un título de la biblioteca del usuario autenticado */
export async function removeFromLibrary(mediaId: string): Promise<void> {
  const response = await fetch('/api/library', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mediaId }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(data.error ?? 'Failed to remove from library')
  }
}
