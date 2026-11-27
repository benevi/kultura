// KULTURA — ¿Bloqueo entre quien mira y el dueño? (páginas públicas /u, /u/l y /r)
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { hasBlockWith, viewerBlockedWith } from '@/lib/social/block-check'

function client(result: { data?: unknown; error?: unknown } | Error) {
  const rpc = vi.fn(async () => {
    if (result instanceof Error) throw result
    return result
  })
  return { supabase: { rpc } as unknown as SupabaseClient, rpc }
}

describe('hasBlockWith', () => {
  it('pregunta a has_block_with con el otro usuario', async () => {
    const { supabase, rpc } = client({ data: true, error: null })
    expect(await hasBlockWith(supabase, 'owner-1')).toBe(true)
    expect(rpc).toHaveBeenCalledWith('has_block_with', { p_other: 'owner-1' })
  })

  it('sin bloqueo: false', async () => {
    expect(await hasBlockWith(client({ data: false, error: null }).supabase, 'o')).toBe(false)
  })

  it('ante un error o una excepción: true (no se enseña)', async () => {
    expect(await hasBlockWith(client({ data: null, error: { message: 'x' } }).supabase, 'o')).toBe(true)
    expect(await hasBlockWith(client(new Error('red')).supabase, 'o')).toBe(true)
  })
})

describe('viewerBlockedWith', () => {
  it('sin sesión o siendo el dueño: false y sin consultar', async () => {
    const { supabase, rpc } = client({ data: true, error: null })
    expect(await viewerBlockedWith(supabase, null, 'o')).toBe(false)
    expect(await viewerBlockedWith(supabase, 'o', 'o')).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('con sesión de otra persona: lo que diga la base', async () => {
    expect(await viewerBlockedWith(client({ data: true, error: null }).supabase, 'v', 'o')).toBe(true)
    expect(await viewerBlockedWith(client({ data: false, error: null }).supabase, 'v', 'o')).toBe(false)
  })
})
