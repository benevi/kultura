// ============================================================
// KULTURA — Campana de la cabecera (ACC-7, ACC-10, MOV-4).
// ============================================================

import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    key === 'notificationsLabel'
      ? (values?.count ? `Notificaciones, ${values.count} sin leer` : 'Notificaciones')
      : key,
}))

const mockPathname = vi.hoisted(() => ({ value: '/home' }))
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className, ...rest }: { href: string; children?: React.ReactNode; className?: string }) => (
    <a href={href} className={className} {...rest}>{children}</a>
  ),
  usePathname: () => mockPathname.value,
}))

import { NotificationsBell } from '@/components/layout/NotificationsBell'

describe('NotificationsBell', () => {
  beforeEach(() => {
    mockPathname.value = '/home'
  })

  it('sin no leídas: sin contador y nombre simple', () => {
    render(<NotificationsBell unreadCount={0} />)
    expect(screen.getByRole('link', { name: 'Notificaciones' })).toHaveAttribute('href', '/notifications')
    expect(screen.queryByText(/^\d+$/)).toBeNull()
  })

  it('el contador va en el nombre accesible; el número pintado es decorativo', () => {
    render(<NotificationsBell unreadCount={3} />)
    expect(screen.getByRole('link', { name: 'Notificaciones, 3 sin leer' })).toBeInTheDocument()
    expect(screen.getByText('3')).toHaveAttribute('aria-hidden')
  })

  it('más de 99 → 99+', () => {
    render(<NotificationsBell unreadCount={100} />)
    expect(screen.getByText('99+')).toBeInTheDocument()
  })

  it('caja de 44×44 con radio 16', () => {
    render(<NotificationsBell unreadCount={0} />)
    const cls = screen.getByRole('link').className
    expect(cls).toContain('w-11')
    expect(cls).toContain('h-11')
    expect(cls).toContain('rounded-2xl')
  })

  // Regresión: con `x-pathname` en el layout, el aria-current se quedaba con
  // la página de entrada porque el layout no se repinta al navegar.
  it('aria-current sigue a la ruta del cliente al navegar', () => {
    const { rerender } = render(<NotificationsBell unreadCount={0} />)
    expect(screen.getByRole('link')).not.toHaveAttribute('aria-current')
    mockPathname.value = '/notifications'
    rerender(<NotificationsBell unreadCount={0} />)
    expect(screen.getByRole('link')).toHaveAttribute('aria-current', 'page')
    mockPathname.value = '/discover'
    rerender(<NotificationsBell unreadCount={0} />)
    expect(screen.getByRole('link')).not.toHaveAttribute('aria-current')
  })
})
