// ============================================================
// KULTURA — 20261101110001_moderation.sql: revisión estática (F-11)
// La comprobación contra una base real está en tests/integration/moderation.
// ============================================================

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { stripComments } from '../rls/migration-lint'

const sql = stripComments(
  readFileSync(path.resolve(__dirname, '../../../supabase/migrations/20261101110001_moderation.sql'), 'utf8'),
).replace(/\s+/g, ' ')

function policy(name: string): string {
  const m = sql.match(new RegExp(`create policy "${name}" on public\\.\\w+ ([^;]*);`, 'i'))
  expect(m, `falta la política ${name}`).not.toBeNull()
  return m![1]
}

describe('migración de moderación', () => {
  it('empieza con la guarda (W1 aplicada, sin políticas desconocidas)', () => {
    expect(sql.indexOf('do $guard$')).toBeLessThan(sql.indexOf('create table'))
    expect(sql).toContain("'Users can join conversations'")
    expect(sql).toContain('kultura.f11_allow_drift')
  })

  it('blocks: CHECK contra uno mismo, RLS y solo la fila propia', () => {
    expect(sql).toMatch(/create table if not exists public\.blocks/)
    expect(sql).toContain('check (blocker_id <> blocked_id)')
    expect(sql).toContain('alter table public.blocks enable row level security')
    expect(policy('blocks_insert_own')).toMatch(/to authenticated with check \(blocker_id = auth\.uid\(\)/)
    expect(policy('blocks_select_own')).toMatch(/using \(blocker_id = auth\.uid\(\)\)/)
    // Bloquear borra la amistad.
    expect(sql).toMatch(/handle_new_block\(\)[^$]*\$\$ begin delete from public\.friendships/)
  })

  it('messages: INSERT solo con can_send_message (amistad vigente y sin bloqueo); DELETE de lo propio', () => {
    expect(policy('Members can send messages')).toBe(
      'for insert to authenticated with check (sender_id = auth.uid() and public.can_send_message(conversation_id))',
    )
    const fn = sql.slice(sql.indexOf('function public.can_send_message'), sql.indexOf('revoke all on function public.can_send_message'))
    expect(fn).toContain("f.status = 'accepted'")
    expect(fn).toContain('public.blocks b')
    expect(fn).toMatch(/o\.user_id <> auth\.uid\(\)/)
    expect(policy('Senders can delete own messages')).toContain('using (sender_id = auth.uid())')
  })

  it('salir: DELETE propio en conversation_members', () => {
    expect(policy('Users can leave conversations')).toBe('for delete to authenticated using (user_id = auth.uid())')
  })

  it('amistad y recomendaciones rechazan si hay bloqueo', () => {
    expect(policy('friendships_insert_as_requester')).toContain('not public.has_block_with(receiver_id)')
    expect(policy('friendships_insert_as_requester')).toContain("status = 'pending'")
    expect(policy('recommendations_insert_as_sender')).toContain('not public.has_block_with(to_user_id)')
  })

  it('el dueño borra posts y expulsa, nunca a sí mismo ni a un owner', () => {
    expect(policy('Group owners can delete posts')).toContain('public.is_group_owner(group_id, auth.uid())')
    const remove = policy('Group owners can remove members')
    expect(remove).toContain('user_id <> auth.uid()')
    expect(remove).toContain("role <> 'owner'")
    expect(policy('Users can join groups')).toContain('not public.is_banned_from_group(group_id)')
  })

  it('reports: tipos ampliados, reporter_id nulo, contacto y resolución; anon fuera', () => {
    expect(sql).toContain("array['user', 'media', 'message', 'group_post', 'group', 'list']")
    expect(sql).toContain('alter column reporter_id drop not null')
    for (const col of ['contact_email text', 'resolved_at timestamptz', 'resolution text']) {
      expect(sql).toContain(`add column if not exists ${col}`)
    }
    expect(sql).toContain('revoke all on public.reports from anon')
    expect(policy('reports_insert_auth')).toContain('reporter_id = auth.uid() and resolved_at is null and resolution is null')
    expect(policy('reports_select_own')).toContain('to authenticated')
  })

  it('funciones SECURITY DEFINER solo sobre auth.uid() y sin EXECUTE para anon', () => {
    for (const fn of ['has_block_with(uuid)', 'can_send_message(uuid)', 'is_banned_from_group(uuid)']) {
      expect(sql).toContain(`revoke all on function public.${fn} from public, anon`)
    }
    expect(sql).not.toMatch(/grant execute on function [^;]* to [^;]*\banon\b/)
  })

  it('termina con el bloque demo_no_* (cubre blocks y group_bans)', () => {
    expect(sql.lastIndexOf('create policy demo_no_insert')).toBeGreaterThan(sql.lastIndexOf('create table'))
    expect(sql.trim().endsWith("notify pgrst, 'reload schema';")).toBe(true)
  })
})
