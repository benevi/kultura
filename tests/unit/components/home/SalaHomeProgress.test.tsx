// ============================================================
// Fase 8.5 · I2a: el «+1» de Inicio en «Sala». El botón es un `SalaButton`
// (48 px) cuyo nombre es su texto visible, y al marcar lo último se abre
// «¿Has terminado…?» en un diálogo de «Sala» con Cancelar primero y el foco
// en él. La lógica (optimista, con vuelta atrás) es la de `useProgressAdvance`.
// ============================================================

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => {
  const make = (ns?: string) => {
    const t = (key: string, values?: Record<string, unknown>) =>
      `${ns ? `${ns}.` : ''}${key}${values ? `:${JSON.stringify(values)}` : ''}`
    t.has = () => true
    return t
  }
  return { useTranslations: make, useLocale: () => 'es' }
})
const advanceProgress = vi.fn()
const completeFromProgress = vi.fn()
vi.mock('@/lib/library/actions', () => ({
  advanceProgress: (...a: unknown[]) => advanceProgress(...a),
  completeFromProgress: (...a: unknown[]) => completeFromProgress(...a),
}))
vi.mock('@/lib/library/motion', () => ({ playStamp: () => false }))

import { SalaHomeProgress } from '@/components/home/sala/SalaHomeProgress'

beforeEach(() => {
  advanceProgress.mockReset()
  completeFromProgress.mockReset()
})

function renderProgress() {
  return render(
    <SalaHomeProgress mediaId="manga_1" mediaType="manga" title="Slime" progress={{ chapter: 99, total: 100 }} status="in_progress" variant="card" />
  )
}

describe('SalaHomeProgress', () => {
  it('el «+1» es un botón de «Sala» con su texto por nombre y la frase completa en la descripción', () => {
    renderProgress()
    const button = screen.getByRole('button', { name: 'progress.quick:{"unit":"chapter"}' })
    expect(button.className).toContain('min-h-sala-target')
    expect(button).toHaveAccessibleDescription('progress.quickLabel:{"unit":"chapter","title":"Slime"}')
  })

  it('al marcar lo último: diálogo de «Sala» con Cancelar primero y el foco en él; Cancelar lo cierra sin completar', async () => {
    advanceProgress.mockResolvedValue({ progress: { chapter: 100, total: 100 }, status: 'in_progress', caughtUp: false, finished: true, diary: true })
    renderProgress()
    fireEvent.click(screen.getByRole('button', { name: 'progress.quick:{"unit":"chapter"}' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'progress.finishTitle:{"title":"Slime"}' })
    const buttons = within(dialog).getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['progress.finishCancel', 'progress.finishConfirm:{"type":"manga"}'])
    await waitFor(() => expect(buttons[0]).toHaveFocus())
    // El diario está activo: la casilla, marcada por defecto.
    expect(within(dialog).getByRole('checkbox', { name: 'progress.finishLog' })).toBeChecked()

    fireEvent.click(buttons[0])
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(completeFromProgress).not.toHaveBeenCalled()
  })

  it('Confirmar pasa a «Completado» y lo apunta en el diario si la casilla sigue marcada', async () => {
    advanceProgress.mockResolvedValue({ progress: { chapter: 100, total: 100 }, status: 'in_progress', caughtUp: false, finished: true, diary: true })
    completeFromProgress.mockResolvedValue({ log: { id: 'l' }, logFailed: false })
    renderProgress()
    fireEvent.click(screen.getByRole('button', { name: 'progress.quick:{"unit":"chapter"}' }))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'progress.finishConfirm:{"type":"manga"}' }))
    await waitFor(() => expect(completeFromProgress).toHaveBeenCalledWith('manga_1', expect.objectContaining({ log: true })))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByTestId('progress-label')).toHaveTextContent('library.status.completed')
  })

  it('si falla, vuelve a lo de antes y lo dice en su hueco (role="alert")', async () => {
    advanceProgress.mockRejectedValue(new Error('x'))
    renderProgress()
    fireEvent.click(screen.getByRole('button', { name: 'progress.quick:{"unit":"chapter"}' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('progress.failed'))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})
