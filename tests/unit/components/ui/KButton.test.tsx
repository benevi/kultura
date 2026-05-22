import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { KButton } from '@/components/ui/KButton'

describe('KButton', () => {
  it('renders children', () => {
    render(<KButton>Click me</KButton>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('loading=true renders spinner and disables button', () => {
    render(<KButton loading>Save</KButton>)
    const btn = screen.getByRole('button', { name: /save/i })
    expect(btn).toBeDisabled()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('loading=true does not fire onClick', () => {
    const onClick = vi.fn()
    render(<KButton loading onClick={onClick}>Save</KButton>)
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('loading=false renders children without spinner', () => {
    render(<KButton loading={false}>Save</KButton>)
    const btn = screen.getByRole('button', { name: 'Save' })
    expect(btn).not.toBeDisabled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('disabled=true disables button independently of loading', () => {
    const onClick = vi.fn()
    render(<KButton disabled onClick={onClick}>Save</KButton>)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('variant secondary applies secondary styles', () => {
    render(<KButton variant="secondary">Cancel</KButton>)
    const btn = screen.getByRole('button', { name: 'Cancel' })
    expect(btn.className).toContain('border-surface-border')
  })
})
