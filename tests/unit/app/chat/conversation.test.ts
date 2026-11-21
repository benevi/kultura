// ============================================================
// KULTURA — /chat/[id]: utilidades puras de la conversación (C12).
// `mergeIncoming` (mensaje llegado por realtime) y `prependOlder` (página
// anterior).
// ============================================================

import { describe, it, expect } from 'vitest'
import {
  mergeIncoming,
  prependOlder,
  isTempMessage,
  type Message,
} from '@/app/[locale]/(app)/chat/[id]/_components/conversation'

function msg(id: string, content: string, sender_id: string | null = 'other', users: Message['users'] = null): Message {
  return { id, content, sender_id, created_at: '2026-11-01T10:00:00Z', users }
}

describe('mergeIncoming', () => {
  it('si el id ya está, devuelve la misma lista (sin duplicar ni reemplazar)', () => {
    const prev = [msg('a', 'hola', 'me'), msg('b', 'qué tal')]
    const out = mergeIncoming(prev, msg('b', 'otro texto', 'other', { username: 'x', avatar_color: '#000', avatar_initials: 'X' }), 'me')
    expect(out).toBe(prev)
  })

  it('eco propio con su temporal pendiente: lo reemplaza en su sitio', () => {
    const prev = [msg('a', 'antes'), msg('temp-1', 'hola', 'me'), msg('b', 'después')]
    const real = msg('real-1', 'hola', 'me')
    const out = mergeIncoming(prev, real, 'me')
    expect(out.map((m) => m.id)).toEqual(['a', 'real-1', 'b'])
    expect(out[1]).toBe(real)
    expect(prev.map((m) => m.id)).toEqual(['a', 'temp-1', 'b'])
  })

  it('eco propio sin temporal con ese texto: va al final', () => {
    const prev = [msg('temp-1', 'otro', 'me')]
    const out = mergeIncoming(prev, msg('real-1', 'hola', 'me'), 'me')
    expect(out.map((m) => m.id)).toEqual(['temp-1', 'real-1'])
  })

  it('mensaje ajeno con el mismo texto que un temporal propio: no lo toca, va al final', () => {
    const prev = [msg('temp-1', 'hola', 'me')]
    const out = mergeIncoming(prev, msg('r-1', 'hola', 'other'), 'me')
    expect(out.map((m) => m.id)).toEqual(['temp-1', 'r-1'])
  })

  // Comportamiento actual (bug 2 de C12, sin arreglar): el temporal se busca
  // solo por el texto. Con dos envíos iguales pendientes, el eco reemplaza
  // siempre el primero, aunque sea el del segundo envío. Se ve igual (mismo
  // texto) y el POST de cada uno lo acaba de cuadrar, pero no es exacto.
  it('dos temporales con el mismo texto: el eco reemplaza el primero', () => {
    const prev = [msg('temp-1', 'hola', 'me'), msg('temp-2', 'hola', 'me')]
    const out = mergeIncoming(prev, msg('real-2', 'hola', 'me'), 'me')
    expect(out.map((m) => m.id)).toEqual(['real-2', 'temp-2'])
  })
})

describe('prependOlder', () => {
  it('pone la página anterior arriba, en su orden', () => {
    const out = prependOlder([msg('c', '3'), msg('d', '4')], [msg('a', '1'), msg('b', '2')])
    expect(out.map((m) => m.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('quita de la página anterior los que ya están (se queda la versión de la lista)', () => {
    const current = msg('c', 'actual')
    const out = prependOlder([current, msg('d', '4')], [msg('b', '2'), msg('c', 'repetido')])
    expect(out.map((m) => m.id)).toEqual(['b', 'c', 'd'])
    expect(out[1]).toBe(current)
  })

  it('página vacía o toda repetida: misma lista', () => {
    const prev = [msg('c', '3')]
    expect(prependOlder(prev, []).map((m) => m.id)).toEqual(['c'])
    expect(prependOlder(prev, [msg('c', '3')]).map((m) => m.id)).toEqual(['c'])
  })
})

describe('isTempMessage', () => {
  it('reconoce el prefijo de los optimistas', () => {
    expect(isTempMessage({ id: 'temp-123' })).toBe(true)
    expect(isTempMessage({ id: '7f1c…' })).toBe(false)
  })
})
