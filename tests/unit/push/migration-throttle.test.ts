// @vitest-environment node
/**
 * Contenido de 20261222340001_push_throttle.sql: idempotente, con su
 * requisito comprobado, sin privilegios de más y con un push_on_event() que es
 * el de 20261222330001 más el bloque del aviso por ráfaga y nada más.
 * (Probada además en un PG16 con pg_net y Vault simulados; ver el PR.)
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

const DIR = path.resolve(__dirname, '../../../supabase/migrations')
const NEW = readFileSync(path.join(DIR, '20261222340001_push_throttle.sql'), 'utf8')
const OLD = readFileSync(path.join(DIR, '20261222330001_push.sql'), 'utf8')

/** Sin comentarios `--` ni espacios repetidos. */
const normalize = (sql: string) =>
  sql
    .split('\n')
    .map((l) => l.replace(/--.*$/, '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')

function functionBody(sql: string, name: string): string {
  const start = sql.indexOf(`create or replace function public.${name}()`)
  expect(start, name).toBeGreaterThanOrEqual(0)
  const open = sql.indexOf('$$', start)
  const close = sql.indexOf('$$', open + 2)
  return sql.slice(open + 2, close)
}

const code = normalize(NEW)

describe('20261222340001_push_throttle.sql', () => {
  it('se para si falta la migración de push y lo dice', () => {
    expect(code).toMatch(/to_regclass\('public\.push_subscriptions'\) is null/)
    expect(code).toMatch(/raise exception 'Aplica antes 20261222330001_push\.sql/)
    // El guardián va antes que cualquier cambio.
    expect(code.indexOf('raise exception')).toBeLessThan(code.indexOf('create or replace function'))
  })

  it('idempotente: todo con OR REPLACE / IF NOT EXISTS', () => {
    expect(code).toContain('alter table public.friendships add column if not exists accepted_at timestamptz')
    expect(code).toContain('create index if not exists messages_conversation_sender_created_idx on public.messages (conversation_id, sender_id, created_at)')
    for (const trigger of ['messages_server_time', 'friendships_track_accepted_at']) {
      expect(code).toContain(`create or replace trigger ${trigger}`)
    }
    expect(code).not.toMatch(/\bcreate (table|trigger|index|function) (?!if not exists)/i)
    expect(code).not.toMatch(/\bdrop table\b|\btruncate\b|\bdelete from\b/i)
  })

  it('la fecha de un mensaje la pone el servidor solo para anon/authenticated', () => {
    const body = normalize(functionBody(NEW, 'messages_server_time'))
    expect(body).toContain("if current_user in ('anon', 'authenticated') then new.created_at := clock_timestamp(); end if;")
    expect(code).toContain('before insert on public.messages for each row execute function public.messages_server_time()')
  })

  it('accepted_at: now() al aceptar, null si no está aceptada; solo en INSERT o UPDATE OF status', () => {
    const body = normalize(functionBody(NEW, 'friendships_track_accepted_at'))
    expect(body).toContain("elsif new.status = 'accepted' and old.status is distinct from 'accepted' then new.accepted_at := now();")
    expect(body).toContain("elsif new.status is distinct from 'accepted' then new.accepted_at := null;")
    expect(code).toContain('before insert or update of status on public.friendships')
  })

  it('sin privilegios de más: nadie ejecuta las funciones y solo push_on_event es SECURITY DEFINER', () => {
    for (const fn of ['messages_server_time', 'friendships_track_accepted_at', 'push_on_event']) {
      expect(code).toContain(`revoke all on function public.${fn}() from public, anon, authenticated`)
    }
    expect(code.match(/security definer/g)).toHaveLength(1)
    expect(code).not.toMatch(/\bgrant\b/i)
    for (const fn of ['messages_server_time', 'friendships_track_accepted_at', 'push_on_event']) {
      expect(normalize(NEW.slice(NEW.indexOf(`function public.${fn}()`)))).toMatch(/^function public\.\w+\(\) returns trigger language plpgsql (security definer )?set search_path = ''/)
    }
  })

  it("push_on_event() es la de 20261222330001 más el bloque PUSH_MESSAGE_BURST y nada más", () => {
    const burst = /if exists \( select 1 from public\.messages p where p\.conversation_id = new\.conversation_id and p\.sender_id = new\.sender_id and p\.id <> new\.id and p\.created_at >= to_timestamp\(floor\(extract\(epoch from new\.created_at\) \/ 30\) \* 30\) and \(p\.created_at < new\.created_at or \(p\.created_at = new\.created_at and p\.id < new\.id\)\) \) then return null; end if; /
    const next = normalize(functionBody(NEW, 'push_on_event'))
    expect(next).toMatch(burst)
    expect(next.replace(burst, '')).toBe(normalize(functionBody(OLD, 'push_on_event')))
  })
})
