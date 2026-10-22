// ============================================================
// KULTURA — Reglas de identidad (F-12): API y base dicen lo mismo
// La migración se prueba de verdad en el proyecto de test (tests/integration/
// identity); aquí se comprueba sin base que el SQL y el TS no se separan.
// ============================================================

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  GENERATED_USERNAME_REGEX,
  RESERVED_USERNAMES,
  TERMS_VERSION,
  USERNAME_REGEX,
  generatedUsername,
  initialsFor,
  isReservedUsername,
  purgeDate,
} from '@/app/api/settings/identity'
import { stripComments } from '../rls/migration-lint'

const SQL = stripComments(
  readFileSync(
    path.resolve(__dirname, '../../../supabase/migrations/20261101120001_identity_privacy.sql'),
    'utf8'
  )
)

/** Cuerpo de `create or replace function public.<name>` hasta su `$$;`. */
function fnBody(name: string): string {
  const start = SQL.search(new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\(`, 'i'))
  expect(start, name).toBeGreaterThan(-1)
  const open = SQL.indexOf('$$', start)
  return SQL.slice(open, SQL.indexOf('$$', open + 2))
}

describe('nombres reservados', () => {
  it('la lista del disparador de la base es la misma que la de la API', () => {
    const block = /lower\(new\.username\) = any \(array\[([\s\S]*?)\]/i.exec(fnBody('validate_username'))?.[1] ?? ''
    const sqlNames = Array.from(block.matchAll(/'([^']+)'/g), (m) => m[1]).sort()
    expect(sqlNames).toEqual([...RESERVED_USERNAMES].sort())
  })

  // Un CHECK (aunque sea NOT VALID) se evalúa en CADA update de la fila: un
  // usuario antiguo "jo" no podría guardar ni la bio. Por eso es un disparador
  // que solo mira el nombre al crearlo o cambiarlo.
  it('sin CHECK de nombre: disparador solo en INSERT o UPDATE OF username', () => {
    expect(SQL).not.toMatch(/add constraint users_username_(format|not_reserved)/i)
    expect(SQL).toMatch(/drop constraint if exists users_username_format/)
    expect(SQL).toMatch(/drop constraint if exists users_username_not_reserved/)
    expect(SQL).toMatch(/before insert or update of username on public\.users/)
    expect(fnBody('validate_username')).toMatch(/tg_op = 'UPDATE' and new\.username is not distinct from old\.username/)
  })

  it('reservado sin distinguir mayúsculas, y nada que empiece por "kultura"', () => {
    expect(isReservedUsername('Admin')).toBe(true)
    expect(isReservedUsername('kultura_oficial')).toBe(true)
    expect(isReservedUsername('KulturaFan')).toBe(true)
    expect(isReservedUsername('lucia_lee')).toBe(false)
  })

  it('el formato de la API es el del disparador validate_username', () => {
    expect(SQL).toContain(`'^[A-Za-z0-9_]{3,20}$'`)
    expect(USERNAME_REGEX.source).toBe('^[A-Za-z0-9_]{3,20}$')
  })
})

describe('nombre generado (R4)', () => {
  it('u_ + 6 caracteres [a-z0-9], también el de respaldo de Inicio', () => {
    for (let i = 0; i < 200; i++) expect(generatedUsername()).toMatch(GENERATED_USERNAME_REGEX)
    expect(generatedUsername(() => new Uint8Array([0, 1, 25, 26, 35, 36]))).toBe('u_abz09a')
  })

  it('handle_new_user ya no lee el email', () => {
    const body = fnBody('handle_new_user')
    expect(body).not.toMatch(/split_part|new\.email/i)
    expect(body).toMatch(/'u_'\s*\|\|\s*code/)
    expect(body).toMatch(/substr\(md5\(/)
  })

  it('handle_new_user guarda la aceptación de términos del alta', () => {
    const body = fnBody('handle_new_user')
    expect(body).toContain(`raw_user_meta_data ->> 'terms_accepted'`)
    expect(body).toContain(`raw_user_meta_data ->> 'terms_version'`)
    expect(body).toMatch(/insert into public\.account_state/i)
  })

  it('las iniciales del avatar no llevan el prefijo u_', () => {
    expect(initialsFor('u_3f9a1c')).toBe('3F')
    expect(initialsFor('lucia_lee')).toBe('LU')
  })
})

describe('política de user_media (D-04b)', () => {
  it('quita la política original (USING true) y cualquier otra SELECT permisiva', () => {
    expect(SQL).toMatch(/drop policy if exists "user_media_select_public" on public\.user_media/)
    expect(SQL).toMatch(/cmd in \('SELECT', 'ALL'\) and permissive = 'PERMISSIVE'/)
  })

  it('solo authenticated, y el dueño o can_read_library', () => {
    expect(SQL).toMatch(
      /create policy "user_media_select_visible" on public\.user_media\s+for select to authenticated\s+using \(user_id = auth\.uid\(\) or public\.can_read_library\(user_id\)\)/
    )
    expect(SQL).toMatch(/drop policy if exists "user_media_select_authenticated" on public\.user_media/)
  })

  it('can_read_library: público, amigos aceptados o el dueño; nunca anon', () => {
    const body = fnBody('can_read_library')
    expect(body).toContain(`library_visibility = 'public'`)
    expect(body).toContain(`library_visibility = 'friends'`)
    expect(body).toContain(`f.status = 'accepted'`)
    expect(SQL).toMatch(/revoke all on function public\.can_read_library\(uuid\) from public, anon;/)
    expect(SQL).not.toMatch(/grant execute on function public\.can_read_library\(uuid\) to anon/)
  })

  it('friends por defecto para todos', () => {
    expect(SQL).toMatch(/add column if not exists library_visibility text not null default 'friends'/)
  })
})

describe('ROJO-8: la demo no cambia credenciales por la API de Auth', () => {
  it('disparador BEFORE UPDATE en auth.users que bloquea email, contraseña y teléfono', () => {
    expect(SQL).toMatch(/create trigger guard_demo_auth_identity\s+before update on auth\.users/)
    const body = fnBody('guard_demo_auth_identity')
    for (const column of ['email', 'encrypted_password', 'email_change', 'phone', 'phone_change']) {
      expect(body).toContain(`coalesce(new.${column}, '')`)
    }
    expect(body).toContain(`raw_app_meta_data ->> 'demo'`)
    expect(body).toContain('demo_auth_locked')
  })

  // Lo que viaja en la fila no dice quién llama: ninguna "llave" en app_metadata
  // puede abrir la demo (un visitante podría aprovechar la ventana).
  it('solo pasan SQL directo sin claims (postgres/service_role) o el claim service_role', () => {
    const body = fnBody('guard_demo_auth_identity')
    expect(SQL).toMatch(/function public\.guard_demo_auth_identity\(\)\s+returns trigger language plpgsql security invoker/)
    expect(body).toContain(`claims_role = 'service_role'`)
    expect(body).toContain(`raw_claims is null and current_user in ('postgres', 'service_role')`)
    expect(body).not.toMatch(/new\.raw_app_meta_data/)
    expect(SQL).not.toContain('demo_auth_unlock_until')
  })

  it('documenta el reset de la demo desde el SQL Editor con la sentencia exacta', () => {
    const raw = readFileSync(
      path.resolve(__dirname, '../../../supabase/migrations/20261101120001_identity_privacy.sql'),
      'utf8'
    )
    expect(raw).toMatch(/set encrypted_password = extensions\.crypt\('<contraseña nueva>', extensions\.gen_salt\('bf'\)\)/)
  })

  it('las funciones de servicio no las ejecuta un usuario', () => {
    for (const fn of ['transfer_owned_content', 'deletion_preview', 'group_successor', 'list_successor']) {
      expect(SQL).toMatch(new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated;`))
      expect(SQL).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to service_role;`))
    }
  })
})

describe('account_state', () => {
  it('anon nada; authenticated solo SELECT', () => {
    expect(SQL).toMatch(/revoke all on public\.account_state from anon, authenticated;\s*grant select on public\.account_state to authenticated;/)
  })
})

describe('varios', () => {
  it('la versión de términos es la fecha de los términos publicados', () => {
    const es = JSON.parse(readFileSync(path.resolve(__dirname, '../../../messages/es.json'), 'utf8'))
    expect(es.legal.terms.updated).toContain('septiembre de 2026')
    expect(TERMS_VERSION).toBe('2026-09')
  })

  it('el borrado se cumple a los 7 días', () => {
    expect(purgeDate('2026-10-22T10:00:00.000Z').toISOString()).toBe('2026-10-29T10:00:00.000Z')
  })
})
