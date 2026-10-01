/**
 * Tests unitarios — ListDetail: la acción de añadir título (artboard ListDetail).
 *
 * El artboard encabeza la pantalla con el nombre de la lista y, a su derecha, la
 * acción primaria "+ Añadir título" en pill pink. En el código esa acción NO
 * existía en la cabecera: solo se llegaba a ella desde el estado vacío, así que
 * en una lista que YA tenía títulos no había forma de añadir otro desde aquí.
 *
 * Lo que se fija es la alcanzabilidad (mismo criterio que el test de "registrarse
 * sigue alcanzable" del Login), no el píxel: el "+" es decoración `aria-hidden`,
 * así que el nombre accesible del enlace es solo la etiqueta traducida.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: vi.fn(() => (key: string) => {
    const map: Record<string, string> = {
      addItem: 'Añadir título',
      deleteList: 'Eliminar lista',
      itemsTitle: 'Títulos',
      items: 'títulos',
      collaborative: 'Lista colaborativa',
      noItems: 'Esta lista está vacía',
      noItemsHint: 'Explora el catálogo',
      noItemsDiscover: 'Explorar contenido',
      membersTitle: 'Miembros',
    }
    return map[key] ?? key
  }),
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

import { ListDetail } from '@/app/[locale]/(app)/lists/[id]/ListDetail'

const list = {
  id: 'l1',
  ownerId: 'u1',
  name: 'Maratón de terror',
  mediaType: null,
  isCollaborative: false,
  createdAt: '',
  owner: undefined,
} as never

function renderDetail(canEdit: boolean) {
  return render(
    <ListDetail
      list={list}
      items={[]}
      members={[]}
      currentUserId="u1"
      currentUserFriends={[]}
      canEdit={canEdit}
    />
  )
}

describe('ListDetail — acción "Añadir título"', () => {
  it('es alcanzable desde la cabecera y lleva al catálogo', () => {
    renderDetail(true)
    const add = screen.getByRole('link', { name: 'Añadir título' })
    expect(add).toHaveAttribute('href', '/discover')
  })

  it('el "+" no entra en el nombre accesible', () => {
    renderDetail(true)
    expect(screen.queryByRole('link', { name: '+ Añadir título' })).toBeNull()
  })

  it('no se ofrece a quien no puede editar la lista', () => {
    renderDetail(false)
    expect(screen.queryByRole('link', { name: 'Añadir título' })).toBeNull()
  })
})
