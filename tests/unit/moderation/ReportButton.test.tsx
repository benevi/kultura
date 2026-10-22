// ============================================================
// KULTURA — ReportButton: accesible (foco, Escape, anuncios) y con referencia
// ============================================================

import { screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ReportButton, InlineConfirm } from '@/components/social/ReportButton'
import { renderEs } from './intl'

const mockFetch = vi.fn()

beforeEach(() => {
  mockFetch.mockReset()
  vi.stubGlobal('fetch', mockFetch)
  // requestAnimationFrame inmediato para comprobar el foco sin esperas.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0 })
})
afterEach(() => vi.unstubAllGlobals())

describe('ReportButton', () => {
  it('el disparador declara el desplegable y al abrir el foco va al primer motivo', () => {
    renderEs(<ReportButton targetType="media" targetId="movie_550" />)
    const trigger = screen.getByRole('button', { name: /denunciar/i })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const form = screen.getByRole('form', { name: '¿Por qué lo denuncias?' })
    expect(trigger).toHaveAttribute('aria-controls', form.id)
    expect(screen.getByRole('radio', { name: 'Acoso o intimidación' })).toHaveFocus()
    expect(screen.getByRole('group', { name: 'Motivo de la denuncia' })).toBeInTheDocument()
    expect(screen.getByLabelText('Detalles (opcional)')).toBeInTheDocument()
  })

  it('Escape cierra y devuelve el foco al botón', () => {
    renderEs(<ReportButton targetType="media" targetId="movie_550" />)
    const trigger = screen.getByRole('button', { name: /denunciar/i })
    fireEvent.click(trigger)
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Spam o estafa' }), { key: 'Escape' })
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('sin motivo no envía y lo anuncia', () => {
    renderEs(<ReportButton targetType="media" targetId="movie_550" />)
    fireEvent.click(screen.getByRole('button', { name: /denunciar/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Enviar denuncia' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Elige un motivo.')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('envía motivo y detalle, y enfoca la confirmación con la referencia', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ reportId: 'r1', reference: 'KR-0F8FAD5B' }) })
    renderEs(<ReportButton targetType="message" targetId="m-1" variant="icon" contextLabel="troll" />)
    fireEvent.click(screen.getByRole('button', { name: 'Denunciar mensaje: troll' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Acoso o intimidación' }))
    fireEvent.change(screen.getByLabelText('Detalles (opcional)'), { target: { value: 'Me insulta' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enviar denuncia' }))
    })
    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent('Denuncia enviada.')
    expect(status).toHaveTextContent('KR-0F8FAD5B')
    await waitFor(() => expect(status).toHaveFocus())
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
      targetType: 'message',
      targetId: 'm-1',
      reason: 'harassment',
      details: 'Me insulta',
    })
  })

  it('un 429 da un mensaje propio y deja el formulario abierto', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: 'Too many requests' }) })
    renderEs(<ReportButton targetType="user" targetId="u-1" />)
    fireEvent.click(screen.getByRole('button', { name: /denunciar/i }))
    fireEvent.click(screen.getByRole('radio', { name: 'Spam o estafa' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enviar denuncia' }))
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('muchas denuncias')
    expect(screen.getByRole('form')).toBeInTheDocument()
  })

  it('la variante icono tiene 44×44 de objetivo', () => {
    renderEs(<ReportButton targetType="group_post" targetId="p-1" variant="icon" contextLabel="ana" />)
    const btn = screen.getByRole('button', { name: 'Denunciar publicación: ana' })
    expect(btn.className).toMatch(/\bw-11\b/)
    expect(btn.className).toMatch(/\bh-11\b/)
  })
})

describe('InlineConfirm', () => {
  it('enfoca Cancelar (lo que no destruye) y Escape cancela', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    renderEs(
      <InlineConfirm title="¿Bloquear?" body="Texto" confirmLabel="Bloquear" cancelLabel="Cancelar" onConfirm={onConfirm} onCancel={onCancel} />,
    )
    const group = screen.getByRole('group', { name: '¿Bloquear?' })
    expect(group).toHaveAccessibleDescription('Texto')
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    fireEvent.keyDown(group, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Bloquear' }))
    expect(onConfirm).toHaveBeenCalled()
  })
})
