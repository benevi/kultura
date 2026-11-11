// ============================================================
// Saneamiento fase 2 · Migración 20261230000001_harden_grants_and_policies.sql
// (estática). La prueba de verdad es contra kultura-test (tests/integration/rls);
// aquí se fija lo que no puede romperse.
// ============================================================

// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { stripComments } from './migration-lint'

const FILE = path.resolve(
  __dirname,
  '../../../supabase/migrations/20261230000001_harden_grants_and_policies.sql'
)
const raw = readFileSync(FILE, 'utf8')
const sql = stripComments(raw).replace(/\s+/g, ' ').toLowerCase()

/** El cuerpo de `create policy "<name>" … ;` */
function policy(name: string): string {
  const start = sql.indexOf(`create policy "${name}"`)
  expect(start, `falta la política ${name}`).toBeGreaterThan(-1)
  return sql.slice(start, sql.indexOf(';', start))
}

describe('migración de permisos y políticas (fase 2)', () => {
  it('empieza explicando qué hace', () => {
    expect(raw.startsWith('-- ')).toBe(true)
    expect(raw).toMatch(/QUÉ HACE/)
  })

  it('1. privilegios por defecto: nada nuevo para anon; sin truncate/references/trigger', () => {
    expect(sql).toContain('alter default privileges for role postgres in schema public revoke all on tables from anon')
    expect(sql).toContain('alter default privileges for role postgres in schema public revoke all on sequences from anon')
    expect(sql).toContain('revoke execute on functions from public, anon')
    expect(sql).toContain('revoke truncate, references, trigger on public.%i from anon, authenticated')
  })

  it('2. pertenencia a grupo/chat: solo sobre quien pregunta, sin anon', () => {
    for (const fn of ['is_group_member', 'is_conversation_member']) {
      const start = sql.indexOf(`create or replace function public.${fn}(`)
      const body = sql.slice(start, sql.indexOf('$$;', start))
      expect(body).toContain('coalesce(uid = auth.uid(), false) and exists')
      expect(sql).toContain(`revoke all on function public.${fn}(uuid, uuid) from public, anon`)
    }
  })

  it('3. sin username_redirect (Q8)', () => {
    expect(sql).toContain('drop function if exists public.username_redirect(text)')
  })

  it('4. recomendar exige amistad aceptada y ningún bloqueo (Q7)', () => {
    const p = policy('recommendations_insert_as_sender')
    expect(p).toContain('for insert to authenticated')
    expect(p).toContain('auth.uid() = from_user_id')
    expect(p).toContain('not public.has_block_with(to_user_id)')
    expect(p).toContain("f.status = 'accepted'")
  })

  it('5 y 7. sin alta directa en grupos ni conversaciones', () => {
    expect(sql).toContain('drop policy if exists "group owners can manage members" on public.group_members')
    expect(sql).toContain('drop policy if exists "authenticated users can create conversations" on public.conversations')
    expect(sql).not.toContain('create policy "group owners can manage members"')
    expect(sql).not.toContain('create policy "authenticated users can create conversations"')
  })

  it('6. list_items: un miembro solo añade en listas colaborativas', () => {
    const p = policy('list_items_insert_member_or_owner')
    expect(p).toContain('auth.uid() = added_by')
    expect(p).toContain('l.is_collaborative')
  })

  it('8. search_path fijo', () => {
    expect(sql).toContain("alter function public.set_updated_at() set search_path = ''")
    expect(sql).toContain("alter function public.is_demo_session() set search_path = ''")
  })

  it('9. la fecha del mensaje la pone el servidor', () => {
    expect(sql).toContain('new.created_at := clock_timestamp()')
    expect(sql).toContain('create or replace trigger messages_server_time before insert on public.messages')
  })

  it('10. borrar la cuenta deja los mensajes sin autor y vacíos (Q6)', () => {
    expect(sql).toContain('alter table public.messages alter column sender_id drop not null')
    expect(sql).toContain('foreign key (sender_id) references public.users(id) on delete set null')
    expect(sql).toContain("new.content := ''")
    expect(sql).toContain('before update of sender_id on public.messages')
  })

  it('idempotente: nada se crea sin su guarda', () => {
    for (const m of sql.matchAll(/create policy "([^"]+)" on public\.(\w+)/g)) {
      expect(sql).toContain(`drop policy if exists "${m[1]}" on public.${m[2]}`)
    }
    expect(sql).toContain('drop constraint if exists messages_sender_id_fkey')
    expect(sql).not.toMatch(/create trigger /)
    expect(sql).not.toMatch(/create index (?!if not exists)/)
  })
})
