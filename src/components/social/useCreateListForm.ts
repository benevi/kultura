'use client'

// ============================================================
// KULTURA — Estado de «Crear lista» (fase 8.5 L2)
// Lo que antes vivía dentro de `CreateListModal`: plantilla, nombre, formato,
// descripción, visibilidad, colaborativa, el error del nombre y el del alta.
// Lo usan el diálogo de hoy y el de «Sala» (`SalaCreateListDialog`): un solo
// sitio decide qué se envía y adónde se va después.
// ============================================================

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { createList } from '@/lib/lists/client'

export const LIST_MEDIA_TYPE_KEYS = ['movie', 'tv', 'anime', 'book', 'comic', 'manga', 'game'] as const
export type ListMediaTypeKey = (typeof LIST_MEDIA_TYPE_KEYS)[number] | 'mixed'

/** D-04c / X5: al crear se pregunta, y lo marcado de inicio es privada. */
export const LIST_VISIBILITIES = ['private', 'public'] as const
export type ListVisibility = (typeof LIST_VISIBILITIES)[number]

/**
 * F-25 (PRO-10): plantillas. «Franquicia» es siempre mixta (Dune: libro +
 * películas + juego); «Ranking personal» numera los títulos y admite
 * cualquier formato. `free` = la lista de siempre.
 */
export const LIST_FORM_TEMPLATES = ['free', 'franchise', 'ranking'] as const
export type ListTemplateKey = (typeof LIST_FORM_TEMPLATES)[number]

export const LIST_DESCRIPTION_MAX = 500
export const LIST_NAME_MAX = 80

export function useCreateListForm(onClose: () => void) {
  const t = useTranslations('lists')
  const router = useRouter()
  const nameRef = useRef<HTMLInputElement>(null)

  const [name, setNameValue] = useState('')
  const [nameError, setNameError] = useState('')
  const [mediaType, setMediaType] = useState<ListMediaTypeKey>('movie')
  const [template, setTemplate] = useState<ListTemplateKey>('free')
  const [description, setDescription] = useState('')
  const [isCollaborative, setIsCollaborative] = useState(false)
  const [visibility, setVisibility] = useState<ListVisibility>('private')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // «Franquicia» fija el tipo en mixta sin perder el que se había elegido:
  // al volver a otra plantilla, el selector conserva su valor.
  const typeLocked = template === 'franchise'
  const effectiveType: ListMediaTypeKey = typeLocked ? 'mixed' : mediaType

  function setName(value: string) {
    setNameValue(value)
    if (nameError && value.trim()) setNameError('')
  }

  function namePlaceholder(): string {
    if (template === 'franchise') return t('franchiseNamePlaceholder')
    if (template === 'ranking') return t('rankingNamePlaceholder')
    return t('namePlaceholder')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      // ACC-3: el error se anuncia y el foco vuelve al campo.
      setNameError(t('nameRequired'))
      nameRef.current?.focus()
      return
    }
    setNameError('')
    setLoading(true)
    setError(null)

    try {
      // Una sola petición: la visibilidad va en el alta (antes, un PATCH
      // aparte que podía fallar y dejarla privada).
      const list = await createList({
        name: name.trim(),
        mediaType: effectiveType,
        isCollaborative,
        isPublic: visibility === 'public',
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(template !== 'free' ? { template } : {}),
      })
      router.push(`/lists/${list.id}`)
      router.refresh()
      onClose()
    } catch {
      setError(t('errorCreate'))
      setLoading(false)
    }
  }

  return {
    nameRef,
    name,
    setName,
    nameError,
    namePlaceholder,
    mediaType,
    setMediaType,
    template,
    setTemplate,
    typeLocked,
    description,
    setDescription,
    isCollaborative,
    setIsCollaborative,
    visibility,
    setVisibility,
    loading,
    error,
    handleCreate,
  }
}
