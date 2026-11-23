// ============================================================
// Fase 8.5 · F2d: los tres diálogos de la ficha con «Sala» (añadir a una
// lista, recomendar, denunciar) van en `SalaDialog`. Mismo comportamiento que
// los de hoy; aquí, lo que es propio de la rama `skin="sala"`: el panel de
// «Sala», el foco al abrir y al cerrar, Escape, las etiquetas y los errores
// dentro del diálogo. Con los textos reales (`renderEs`): una clave que falte
// rompe el test.
// ============================================================

import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import type { MediaItem } from '@/types/media'
import { renderEs } from '../../moderation/intl'

const mockShow = vi.fn()
vi.mock('@/components/ui/ToastProvider', () => ({
  useToastContext: () => ({ show: mockShow, showError: vi.fn(), dismiss: vi.fn() }),
}))
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={`/es${href}`} {...rest}>
      {children}
    </a>
  ),
}))
// En la app llegan por next/dynamic; aquí, directos (el import perezoso se comprueba abajo).
vi.mock('@/components/sala/SalaButtonLazy', async () => ({
  SalaButtonLazy: (await import('@/components/sala/SalaButton')).SalaButton,
}))
vi.mock('@/components/social/sala/SalaSocialDialogsLazy', async () => ({
  SalaAddToListDialogLazy: (await import('@/components/social/sala/SalaAddToListDialog')).SalaAddToListDialog,
  SalaRecommendDialogLazy: (await import('@/components/social/sala/SalaRecommendDialog')).SalaRecommendDialog,
}))
vi.mock('@/components/social/sala/SalaReportDialogLazy', async () => ({
  SalaReportDialogLazy: (await import('@/components/social/sala/SalaReportDialog')).SalaReportDialog,
}))

import { AddToListButton } from '@/components/social/AddToListButton'
import { RecommendButton } from '@/components/social/RecommendButton'
import { ReportButton } from '@/components/social/ReportButton'

const item: MediaItem = { id: 'movie_550', externalId: '550', type: 'movie', title: 'Fight Club' }

const mockFetch = vi.fn()
const ok = (data: unknown, status = 200) => ({ ok: true, status, json: async () => ({ data }) })

beforeEach(() => {
  mockFetch.mockReset()
  mockShow.mockReset()
  vi.stubGlobal('fetch', mockFetch)
})
afterEach(() => vi.unstubAllGlobals())

/** El panel es el de «Sala», no el `Modal` de hoy. */
function expectSalaPanel(dialog: HTMLElement) {
  expect(dialog).toHaveAttribute('data-sala-dialog', 'sheet')
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(document.querySelector('[data-testid="modal-panel"]')).toBeNull()
}

describe('F2d: añadir a una lista en SalaDialog', () => {
  const lists = [
    { id: 'l1', name: 'Pelis para el finde', media_type: 'movie', is_collaborative: false },
    { id: 'l2', name: 'Mis libros', media_type: 'book', is_collaborative: false },
    { id: 'l3', name: 'De todo', media_type: 'mixed', is_collaborative: false },
  ]

  it('abre el diálogo de «Sala»: radios de las listas compatibles, foco dentro, Escape devuelve el foco', async () => {
    mockFetch.mockResolvedValueOnce(ok(lists))
    renderEs(<AddToListButton item={item} skin="sala" />)
    const trigger = screen.getByRole('button', { name: 'Añadir a lista' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
    trigger.focus()
    await act(async () => fireEvent.click(trigger))
    const dialog = screen.getByRole('dialog', { name: 'Añadir a una lista' })
    expectSalaPanel(dialog)
    const group = await within(dialog).findByRole('radiogroup', { name: 'Selecciona una lista' })
    expect(within(group).getAllByRole('radio').map((r) => r.getAttribute('value'))).toEqual(['l1', 'l3'])
    expect(dialog.contains(document.activeElement)).toBe(true)
    // «Añadir» espera a que se elija una lista.
    expect(within(dialog).getByRole('button', { name: 'Añadir' })).toBeDisabled()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(trigger).toHaveFocus()
  })

  it('añade a la lista elegida, avisa y cierra', async () => {
    mockFetch.mockResolvedValueOnce(ok(lists)).mockResolvedValueOnce(ok({ id: 'i1' }, 201))
    renderEs(<AddToListButton item={item} skin="sala" />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Añadir a lista' })))
    const dialog = screen.getByRole('dialog', { name: 'Añadir a una lista' })
    fireEvent.click(await within(dialog).findByRole('radio', { name: 'Pelis para el finde' }))
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Añadir' })))
    expect(mockFetch).toHaveBeenLastCalledWith('/api/lists/l1/items', expect.objectContaining({ method: 'POST' }))
    expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('el error al añadir se anuncia dentro y el diálogo sigue abierto', async () => {
    mockFetch
      .mockResolvedValueOnce(ok(lists))
      .mockResolvedValueOnce({ ok: false, status: 500, headers: new Headers(), json: async () => ({ error: { code: 'internal' } }) })
    renderEs(<AddToListButton item={item} skin="sala" />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Añadir a lista' })))
    const dialog = screen.getByRole('dialog', { name: 'Añadir a una lista' })
    fireEvent.click(await within(dialog).findByRole('radio', { name: 'De todo' }))
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Añadir' })))
    const alert = dialog.querySelector('[data-sala-dialog-error]')!
    expect(alert).toHaveAttribute('role', 'alert')
    expect(alert).toHaveTextContent('No hemos podido añadir el título')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('sin listas: lo dice y enlaza a crear una; el enlace cierra el diálogo', async () => {
    mockFetch.mockResolvedValueOnce(ok([]))
    renderEs(<AddToListButton item={item} skin="sala" />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Añadir a lista' })))
    const dialog = screen.getByRole('dialog', { name: 'Añadir a una lista' })
    expect(await within(dialog).findByText('No tienes listas todavía')).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Añadir' })).toBeNull()
    const link = within(dialog).getByRole('link', { name: 'Crea una lista' })
    expect(link).toHaveAttribute('href', '/es/lists')
    await act(async () => fireEvent.click(link))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})

describe('F2d: recomendar en SalaDialog', () => {
  const friends = [
    { friendshipId: 'f1', user: { id: 'u1', username: 'ana', avatar_color: 'blue', avatar_initials: 'AN' } },
    { friendshipId: 'f2', user: { id: 'u2', username: 'leo', avatar_color: 'red', avatar_initials: 'LE' } },
  ]

  it('amigos como casillas con su nombre (sin las iniciales), mensaje con etiqueta, Escape devuelve el foco', async () => {
    mockFetch.mockResolvedValueOnce(ok(friends))
    renderEs(<RecommendButton item={item} skin="sala" />)
    const trigger = screen.getByRole('button', { name: 'Recomendar' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
    trigger.focus()
    await act(async () => fireEvent.click(trigger))
    const dialog = screen.getByRole('dialog', { name: 'Recomendar a un amigo' })
    expectSalaPanel(dialog)
    const group = within(dialog).getByRole('group', { name: 'Selecciona uno o más amigos' })
    expect(await within(group).findByRole('checkbox', { name: 'ana' })).toBeInTheDocument()
    expect(within(group).getByRole('checkbox', { name: 'leo' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Mensaje (opcional)')).toHaveAttribute('maxlength', '500')
    expect(within(dialog).getByRole('button', { name: 'Enviar recomendación' })).toBeDisabled()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(trigger).toHaveFocus()
  })

  it('envía una recomendación por amigo con el mensaje y lo anuncia', async () => {
    mockFetch.mockImplementation(async (url: string) => (url === '/api/friends' ? ok(friends) : ok({ id: 'r' }, 201)))
    renderEs(<RecommendButton item={item} skin="sala" />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Recomendar' })))
    const dialog = screen.getByRole('dialog', { name: 'Recomendar a un amigo' })
    fireEvent.click(await within(dialog).findByRole('checkbox', { name: 'leo' }))
    fireEvent.change(within(dialog).getByLabelText('Mensaje (opcional)'), { target: { value: 'Te va a encantar' } })
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Enviar recomendación' })))
    const post = mockFetch.mock.calls.find(([url]) => url === '/api/recommendations')!
    expect(JSON.parse(post[1].body)).toMatchObject({ toUserId: 'u2', mediaId: 'movie_550', message: 'Te va a encantar' })
    expect(within(dialog).getAllByRole('status').some((s) => s.textContent === '¡Recomendación enviada!')).toBe(true)
  })

  it('si falla, el error va dentro del diálogo, que sigue abierto', async () => {
    mockFetch.mockImplementation(async (url: string) =>
      url === '/api/friends' ? ok(friends) : { ok: false, status: 500, headers: new Headers(), json: async () => ({ error: { code: 'internal' } }) }
    )
    renderEs(<RecommendButton item={item} skin="sala" />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Recomendar' })))
    const dialog = screen.getByRole('dialog', { name: 'Recomendar a un amigo' })
    fireEvent.click(await within(dialog).findByRole('checkbox', { name: 'ana' }))
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Enviar recomendación' })))
    expect(dialog.querySelector('[data-sala-dialog-error]')).toHaveTextContent('No hemos podido enviar la recomendación')
  })
})

describe('F2d: denunciar en SalaDialog', () => {
  it('abre un diálogo con nombre (qué se denuncia): foco en el primer motivo; Escape lo cierra y devuelve el foco', async () => {
    renderEs(<ReportButton targetType="media" targetId="movie_550" skin="sala" closeLabel="Cerrar" />)
    const trigger = screen.getByRole('button', { name: 'Denunciar' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
    expect(trigger).not.toHaveAttribute('aria-expanded')
    trigger.focus()
    await act(async () => fireEvent.click(trigger))
    const dialog = screen.getByRole('dialog', { name: 'Denunciar título' })
    expectSalaPanel(dialog)
    const reasons = within(dialog).getByRole('radiogroup', { name: '¿Por qué lo denuncias?' })
    expect(reasons).toHaveAttribute('aria-required', 'true')
    expect(within(reasons).getByRole('radio', { name: 'Acoso o intimidación' })).toHaveFocus()
    expect(within(dialog).getByLabelText('Detalles (opcional)')).toBeInTheDocument()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(trigger).toHaveFocus()
  })

  it('sin motivo no envía: el error lo lleva el grupo y el foco va al primer motivo', async () => {
    renderEs(<ReportButton targetType="media" targetId="movie_550" skin="sala" closeLabel="Cerrar" />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Denunciar' })))
    const dialog = screen.getByRole('dialog', { name: 'Denunciar título' })
    const submit = within(dialog).getByRole('button', { name: 'Enviar denuncia' })
    submit.focus()
    await act(async () => fireEvent.click(submit))
    expect(mockFetch).not.toHaveBeenCalled()
    const first = within(dialog).getByRole('radio', { name: 'Acoso o intimidación' })
    expect(first).toHaveFocus()
    expect(first).toHaveAccessibleDescription(/Elige un motivo/)
    expect(within(dialog).getByRole('radiogroup')).toHaveAttribute('aria-invalid', 'true')
    // El error del diálogo es para el envío: aquí, vacío.
    expect(dialog.querySelector('[data-sala-dialog-error]')).toHaveTextContent('')
  })

  it('envía, cierra y el foco va a la confirmación con la referencia (que sustituye al botón)', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ reportId: 'r1', reference: 'KR-0F8FAD5B' }) })
    renderEs(<ReportButton targetType="media" targetId="movie_550" skin="sala" closeLabel="Cerrar" />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Denunciar' })))
    const dialog = screen.getByRole('dialog', { name: 'Denunciar título' })
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Spam o estafa' }))
    fireEvent.change(within(dialog).getByLabelText('Detalles (opcional)'), { target: { value: 'Enlaces raros' } })
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Enviar denuncia' })))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Denuncia enviada.')
    expect(status).toHaveTextContent('KR-0F8FAD5B')
    await waitFor(() => expect(status).toHaveFocus())
    expect(screen.queryByRole('button', { name: 'Denunciar' })).toBeNull()
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
      targetType: 'media',
      targetId: 'movie_550',
      reason: 'spam',
      details: 'Enlaces raros',
    })
  })

  it('sin `closeLabel` (fuera de la ficha) no hay botón de cerrar: cierran Escape y «Cancelar»', async () => {
    renderEs(<ReportButton targetType="user" targetId="u-1" skin="sala" />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Denunciar' })))
    const dialog = screen.getByRole('dialog', { name: 'Denunciar usuario' })
    expect(within(dialog).queryByRole('button', { name: 'Cerrar' })).toBeNull()
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' })))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('un 429 se anuncia dentro del diálogo, que sigue abierto', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: 'Too many requests' }) })
    renderEs(<ReportButton targetType="media" targetId="movie_550" skin="sala" closeLabel="Cerrar" />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Denunciar' })))
    const dialog = screen.getByRole('dialog', { name: 'Denunciar título' })
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Spam o estafa' }))
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Enviar denuncia' })))
    expect(dialog.querySelector('[data-sala-dialog-error]')).toHaveTextContent('muchas denuncias')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('F2d: la ficha de hoy no descarga los diálogos de «Sala»', () => {
  it('llegan por next/dynamic y nadie los importa directos', () => {
    const lazy = readFileSync('src/components/social/sala/SalaSocialDialogsLazy.tsx', 'utf8')
    for (const name of ['SalaAddToListDialog', 'SalaRecommendDialog']) expect(lazy).toContain(`import("./${name}")`)
    // El de denunciar, aparte: `ReportButton` se usa también fuera de la ficha.
    expect(readFileSync('src/components/social/sala/SalaReportDialogLazy.tsx', 'utf8')).toContain('import("./SalaReportDialog")')
    for (const [f, lazyFile] of [
      ['src/components/social/AddToListButton.tsx', 'SalaSocialDialogsLazy'],
      ['src/components/social/RecommendButton.tsx', 'SalaSocialDialogsLazy'],
      ['src/components/social/ReportButton.tsx', 'SalaReportDialogLazy'],
    ]) {
      const src = readFileSync(f, 'utf8')
      expect(src).toContain(`sala/${lazyFile}'`)
      expect(src).not.toMatch(/from ['"][^'"]*sala\/Sala(AddToList|Recommend|Report)Dialog['"]/)
      expect(src).not.toMatch(/from ['"]@\/components\/sala\/SalaDialog['"]/)
    }
  })
})
