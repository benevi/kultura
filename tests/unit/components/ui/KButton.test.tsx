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
    // El spinner es decorativo dentro del botón: el estado lo da `aria-busy`
    // y el nombre sigue siendo el texto (antes se colaba "Cargando" en español).
    expect(btn).toHaveAttribute('aria-busy', 'true')
    expect(btn.querySelector('svg.animate-spin')).toHaveAttribute('aria-hidden', 'true')
    expect(btn).toHaveAccessibleName('Save')
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

  // E-BOTON-PINK: el primario es pink, no el lime semántico. Parecía que el
  // canvas no lo zanjaba (14 pills lime vs. 13 pink), pero TODOS los lime son
  // badges de match —retirados de la UI—; de los pills de ACCIÓN, los 13 son
  // pink. Coincide con el sistema de diseño: "primario = fondo pink + texto on-pink".
  it('variant primary es pink, no accent-positive', () => {
    render(<KButton>Guardar</KButton>)
    const btn = screen.getByRole('button', { name: 'Guardar' })
    expect(btn.className).toContain('bg-accent-pink')
    expect(btn.className).toContain('text-on-accent-pink')
    expect(btn.className).not.toContain('bg-accent-positive')
  })

  // C14 (PR 5): el foco era un `ring` (box-shadow), que con colores forzados
  // no se pinta. Ahora es un `outline` pink de 2 px separado 2 px, que el
  // sistema sí pinta con su color. jsdom no aplica Tailwind: se mira la clase.
  it.each(['primary', 'secondary', 'tonal', 'danger'] as const)(
    'el foco de %s es un outline, no un ring',
    (variant) => {
      render(<KButton variant={variant}>Foco</KButton>)
      const classes = screen.getByRole('button', { name: 'Foco' }).className.split(/\s+/)
      expect(classes).toContain('focus-visible:[outline-style:solid]')
      expect(classes).toEqual(expect.arrayContaining(['outline-2', 'outline-offset-2', 'outline-focus-ring']))
      expect(classes).not.toContain('focus-visible:outline-none')
      expect(classes.filter((c) => /(^|:)ring(-|$)/.test(c))).toEqual([])
    }
  )

  it('el foco también es un outline con asChild', () => {
    render(
      <KButton asChild>
        <a href="#x">Enlace</a>
      </KButton>
    )
    const link = screen.getByRole('link', { name: 'Enlace' })
    expect(link.className).toContain('focus-visible:[outline-style:solid]')
    expect(link.className).not.toMatch(/(^|\s|:)ring-/)
  })

  // Variantes nuevas (C14): copian los botones hechos a mano que sustituirán.
  it('variant tonal: fondo elevado sin borde y pink al pasar el ratón', () => {
    render(<KButton variant="tonal">Compartir</KButton>)
    const classes = screen.getByRole('button', { name: 'Compartir' }).className.split(/\s+/)
    expect(classes).toEqual(
      expect.arrayContaining(['font-bold', 'bg-surface-elevated', 'text-text-primary', 'hover:text-accent-pink'])
    )
    expect(classes).not.toContain('border-2')
  })

  it('variant danger: secundario apagado que se tiñe de rojo al pasar el ratón', () => {
    render(<KButton variant="danger" size="sm">Bloquear</KButton>)
    const classes = screen.getByRole('button', { name: 'Bloquear' }).className.split(/\s+/)
    expect(classes).toEqual(
      expect.arrayContaining([
        'border-2',
        'border-surface-border',
        'text-text-tertiary',
        'hover:text-accent-danger',
        'hover:border-accent-danger',
        'text-xs',
      ])
    )
    expect(classes).not.toContain('hover:text-text-primary')
  })
})
