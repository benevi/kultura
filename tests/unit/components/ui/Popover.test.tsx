import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/Popover'

// jsdom no implementa estas APIs que Radix usa internamente.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {}
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {}
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
})

function Fixture() {
  return (
    <Popover>
      <PopoverTrigger>Abrir</PopoverTrigger>
      <PopoverContent>Contenido popover</PopoverContent>
    </Popover>
  )
}

describe('Popover', () => {
  it('Trigger renderiza', () => {
    render(<Fixture />)
    expect(screen.getByText('Abrir')).toBeInTheDocument()
  })

  it('Content oculto por defecto', () => {
    render(<Fixture />)
    expect(screen.queryByText('Contenido popover')).not.toBeInTheDocument()
  })

  it('click en Trigger abre Content (portal)', async () => {
    render(<Fixture />)
    fireEvent.click(screen.getByText('Abrir'))
    expect(await screen.findByText('Contenido popover')).toBeInTheDocument()
  })
})
