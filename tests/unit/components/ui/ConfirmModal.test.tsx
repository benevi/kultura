import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { ConfirmModal } from '@/components/ui/ConfirmModal'

const defaultProps = {
  isOpen: true,
  title: 'Delete list',
  message: 'This cannot be undone.',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
}

describe('ConfirmModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('no renderiza nada cuando isOpen=false', () => {
    const { container } = render(<ConfirmModal {...defaultProps} isOpen={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renderiza título y mensaje cuando isOpen=true', () => {
    render(<ConfirmModal {...defaultProps} />)
    expect(screen.getByText('Delete list')).toBeInTheDocument()
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()
  })

  it('click en confirmar llama onConfirm', () => {
    const onConfirm = vi.fn()
    render(<ConfirmModal {...defaultProps} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByText('Confirm'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('click en cancelar llama onCancel', () => {
    const onCancel = vi.fn()
    render(<ConfirmModal {...defaultProps} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('click en overlay llama onCancel', () => {
    const onCancel = vi.fn()
    render(<ConfirmModal {...defaultProps} onCancel={onCancel} />)
    fireEvent.click(screen.getByTestId('modal-overlay'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('click en panel NO cierra (stopPropagation)', () => {
    const onCancel = vi.fn()
    render(<ConfirmModal {...defaultProps} onCancel={onCancel} />)
    fireEvent.click(screen.getByTestId('modal-panel'))
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('loading deshabilita los botones', () => {
    render(<ConfirmModal {...defaultProps} loading />)
    expect(screen.getByText('Confirm').closest('button')).toBeDisabled()
    expect(screen.getByText('Cancel').closest('button')).toBeDisabled()
  })

  it('isDestructive aplica estilo de peligro al botón de confirmar', () => {
    render(<ConfirmModal {...defaultProps} isDestructive />)
    expect(screen.getByText('Confirm').closest('button')).toHaveClass('bg-accent-danger')
  })
})
