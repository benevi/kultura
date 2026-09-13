// ============================================================
// KULTURA — E-AVATAR-ICONS: personaje del avatar
//
// La regla que cubre este archivo: el personaje es OPCIONAL y aditivo. Las
// cuentas y grupos que existían antes no tienen ninguno, así que todo lo que se
// pinte sin icono debe seguir mostrando las iniciales de siempre.
// ============================================================

import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Avatar } from '@/components/ui/Avatar'
import { AvatarIconPicker } from '@/components/ui/AvatarIconPicker'
import { AVATAR_ICONS, AVATAR_ICON_KEYS, isValidAvatarIcon } from '@/components/icons/avatars'

describe('catálogo de personajes', () => {
  it('expone las claves del catálogo y todas apuntan a un componente', () => {
    expect(AVATAR_ICON_KEYS.length).toBeGreaterThan(0)
    for (const key of AVATAR_ICON_KEYS) {
      expect(typeof AVATAR_ICONS[key]).toBe('function')
    }
  })

  it('isValidAvatarIcon acepta solo claves del catálogo', () => {
    expect(isValidAvatarIcon(AVATAR_ICON_KEYS[0])).toBe(true)
    expect(isValidAvatarIcon('no-existe')).toBe(false)
    expect(isValidAvatarIcon(null)).toBe(false)
    expect(isValidAvatarIcon(42)).toBe(false)
  })
})

describe('Avatar', () => {
  it('sin icono pinta las iniciales (cuentas anteriores a esta función)', () => {
    render(<Avatar initials="VF" />)
    expect(screen.getByText('VF')).toBeInTheDocument()
  })

  it('con icono pinta el personaje en lugar de las iniciales', () => {
    const { container } = render(<Avatar initials="VF" icon="robot" />)
    expect(screen.queryByText('VF')).not.toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('una clave desconocida cae a las iniciales, no deja el avatar vacío', () => {
    render(<Avatar initials="VF" icon="personaje-borrado" />)
    expect(screen.getByText('VF')).toBeInTheDocument()
  })
})

describe('AvatarIconPicker', () => {
  it('ofrece una opción por personaje más la de "sin personaje"', () => {
    render(
      <AvatarIconPicker value={null} onChange={vi.fn()} label="Personaje" noneLabel="Sin personaje" />
    )
    expect(screen.getAllByRole('radio')).toHaveLength(AVATAR_ICON_KEYS.length + 1)
  })

  it('marca como seleccionada la opción activa', () => {
    render(
      <AvatarIconPicker value="cat" onChange={vi.fn()} label="Personaje" noneLabel="Sin personaje" />
    )
    expect(screen.getByRole('radio', { name: 'cat' })).toHaveAttribute('aria-checked', 'true')
  })

  it('sin personaje elegido, la opción de iniciales queda marcada', () => {
    render(
      <AvatarIconPicker value={null} onChange={vi.fn()} label="Personaje" noneLabel="Sin personaje" />
    )
    expect(screen.getByRole('radio', { name: 'Sin personaje' })).toHaveAttribute('aria-checked', 'true')
  })

  it('elegir un personaje lo comunica por su clave', async () => {
    const onChange = vi.fn()
    render(
      <AvatarIconPicker value={null} onChange={onChange} label="Personaje" noneLabel="Sin personaje" />
    )
    screen.getByRole('radio', { name: 'ninja' }).click()
    expect(onChange).toHaveBeenCalledWith('ninja')
  })

  it('volver a iniciales comunica null, no una cadena vacía', () => {
    const onChange = vi.fn()
    render(
      <AvatarIconPicker value="ninja" onChange={onChange} label="Personaje" noneLabel="Sin personaje" />
    )
    screen.getByRole('radio', { name: 'Sin personaje' }).click()
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
