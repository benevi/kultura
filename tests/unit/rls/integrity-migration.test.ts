// ============================================================
// Saneamiento fase 3 · Migración 20261231000001_integrity_and_indexes.sql
// (estática). La prueba contra la base está en tests/integration/rls/fase3.test.ts.
// ============================================================

// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { stripComments } from './migration-lint'

const FILE = path.resolve(__dirname, '../../../supabase/migrations/20261231000001_integrity_and_indexes.sql')
const raw = readFileSync(FILE, 'utf8')
const sql = stripComments(raw).replace(/\s+/g, ' ').toLowerCase()

describe('migración de integridad e índices (fase 3)', () => {
  it('empieza explicando qué hace', () => {
    expect(raw.startsWith('-- ')).toBe(true)
    expect(raw).toMatch(/QUÉ HACE/)
  })

  it('1. únicas: amistad por pareja, título por lista, conversación por pareja', () => {
    expect(sql).toContain(
      'create unique index if not exists friendships_pair_key on public.friendships (least(requester_id, receiver_id), greatest(requester_id, receiver_id))'
    )
    expect(sql).toContain('create unique index if not exists list_items_list_media_key on public.list_items (list_id, media_id)')
    expect(sql).toContain('create unique index if not exists conversations_pair_key on public.conversations (user_low, user_high)')
    expect(sql).toContain('check (user_low < user_high)')
  })

  it('1. la RPC rellena la pareja y aguanta dos peticiones a la vez', () => {
    expect(sql).toContain('insert into conversations (user_low, user_high) values (v_low, v_high) on conflict (user_low, user_high) do nothing')
    expect(sql).toContain('revoke all on function public.create_conversation_with_members(uuid) from public, anon')
    // Sigue exigiendo amistad y ausencia de bloqueo.
    expect(sql).toContain("raise exception 'not_friends'")
  })

  it('2. user_media.media_id en cascada', () => {
    expect(sql).toContain('foreign key (media_id) references public.media(id) on delete cascade')
  })

  it('3. índices de las consultas frecuentes', () => {
    for (const idx of [
      'on public.notifications (user_id, created_at desc)',
      'on public.group_posts (group_id, created_at)',
      'on public.messages (conversation_id, created_at)',
      "on public.media ((metadata->>'malid'))",
      'on public.friendships (receiver_id)',
      'on public.user_media (media_id)',
    ]) {
      expect(sql).toContain(idx)
    }
  })

  it('idempotente: todo índice con if not exists', () => {
    expect(sql).not.toMatch(/create (unique )?index (?!if not exists)/)
    expect(sql).toContain('add column if not exists user_low')
    expect(sql).toContain('drop constraint if exists user_media_media_id_fkey')
  })
})
