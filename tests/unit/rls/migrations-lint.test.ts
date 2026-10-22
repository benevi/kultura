// ============================================================
// KULTURA — Las migraciones del repo no dejan agujeros de RLS evidentes
// (ROJO-8 y reglas de migración del plan; ver migration-lint.ts)
// ============================================================

import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { lintMigrations, stripComments, type Migration } from './migration-lint'

const DIR = path.resolve(__dirname, '../../../supabase/migrations')
const repo: Migration[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((name) => ({ name, sql: readFileSync(path.join(DIR, name), 'utf8') }))

const DEMO_BLOCK = `
do $$ declare t record; begin
  for t in select c.relname from pg_class c where c.relrowsecurity loop
    execute format('create policy demo_no_insert on public.%I as restrictive for insert to authenticated with check (not public.is_demo_session())', t.relname);
  end loop;
end $$;`

describe('migraciones del repo', () => {
  it('cumplen todas las reglas (RLS, demo_no_*, TO, WITH CHECK, revoke)', () => {
    expect(lintMigrations(repo)).toEqual([])
  })

  it('la de F-02 termina volviendo a ejecutar el bloque demo_no_*', () => {
    const mine = repo.find((m) => m.name.startsWith('20261023020001'))
    expect(mine).toBeDefined()
    const sql = stripComments(mine!.sql)
    const demo = sql.search(/relrowsecurity[\s\S]*?create\s+policy\s+demo_no_insert/i)
    const lastPolicy = Array.from(sql.matchAll(/create\s+policy\s+"/gi)).pop()?.index ?? -1
    expect(demo).toBeGreaterThan(lastPolicy)
  })

  it('ninguna política UPDATE de las migraciones queda sin WITH CHECK tras F-02', () => {
    // Las políticas que F-02 recrea con WITH CHECK; si alguien vuelve a
    // crearlas sin él en una migración posterior, la regla 3 lo pilla.
    const mine = stripComments(repo.find((m) => m.name.startsWith('20261023020001'))!.sql)
    for (const name of [
      'friendships_update_as_receiver',
      'group_invitations_update_as_invitee',
      'Users can update their own read status',
      'users_update_own',
      'user_media_update_own',
      'Owners can update groups',
      'lists_update_own',
      'recommendations_update_as_receiver',
      'notifications_update_own',
    ]) {
      const re = new RegExp(`create\\s+policy\\s+"${name}"[^;]*with\\s+check`, 'i')
      expect(re.test(mine), name).toBe(true)
    }
  })
})

describe('el lint detecta lo que tiene que detectar', () => {
  const base = repo.filter((m) => m.name < '20261023')

  it('tabla nueva con escritura y sin volver a ejecutar el bloque demo → falla', () => {
    const bad: Migration = {
      name: '20261101990001_tabla_nueva.sql',
      sql: `create table if not exists public.cosas (id uuid primary key, user_id uuid);
            alter table public.cosas enable row level security;
            drop policy if exists "cosas_insert_own" on public.cosas;
            create policy "cosas_insert_own" on public.cosas for insert to authenticated
              with check (user_id = auth.uid());`,
    }
    expect(lintMigrations([...base, bad])).toEqual([
      expect.stringContaining('la tabla cosas admite escritura de authenticated'),
    ])
    // Con el bloque al final, pasa.
    expect(lintMigrations([...base, { ...bad, sql: bad.sql + DEMO_BLOCK }])).toEqual([])
  })

  it('el bloque demo ANTES de crear la tabla no la cubre', () => {
    const bad: Migration = {
      name: '20261101990001_tabla_nueva.sql',
      sql: `${DEMO_BLOCK}
            create table if not exists public.cosas (id uuid primary key, user_id uuid);
            alter table public.cosas enable row level security;
            create policy "cosas_del_own" on public.cosas for delete to authenticated using (user_id = auth.uid());`,
    }
    expect(lintMigrations([...base, bad]).join()).toContain('la tabla cosas admite escritura')
  })

  it('una tabla sin políticas de escritura (solo servidor) no necesita el bloque', () => {
    const ok: Migration = {
      name: '20261101990001_solo_servidor.sql',
      sql: `create table if not exists public.ai_usage (day date primary key);
            alter table public.ai_usage enable row level security;`,
    }
    expect(lintMigrations([...base, ok])).toEqual([])
  })

  it('tabla sin RLS → falla', () => {
    const bad: Migration = {
      name: '20261101990001_sin_rls.sql',
      sql: `create table if not exists public.abierta (id int);`,
    }
    expect(lintMigrations([...base, bad])).toEqual([expect.stringContaining('la tabla abierta no activa RLS')])
  })

  it('política nueva sin TO o UPDATE sin WITH CHECK → falla', () => {
    const bad: Migration = {
      name: '20261101990001_politicas.sql',
      sql: `create policy "p1" on public.lists for select using (true);
            create policy "p2" on public.lists for update to authenticated using (owner_id = auth.uid());`,
    }
    const problems = lintMigrations([...base, bad])
    expect(problems).toContainEqual(expect.stringContaining('"p1" de lists no lleva TO'))
    expect(problems).toContainEqual(expect.stringContaining('"p2" (update) de lists no lleva WITH CHECK'))
  })

  it('función SECURITY DEFINER nueva sin revoke a PUBLIC → falla', () => {
    const fn = `create or replace function public.contar(p uuid) returns int
                language sql security definer set search_path = public, pg_temp
                as $$ select 1 $$;`
    const bad: Migration = { name: '20261101990001_fn.sql', sql: fn }
    expect(lintMigrations([...base, bad])).toEqual([
      expect.stringContaining('SECURITY DEFINER contar no se revoca a PUBLIC'),
    ])
    const good: Migration = {
      name: '20261101990001_fn.sql',
      sql: fn + `\nrevoke all on function public.contar(uuid) from public, anon;`,
    }
    expect(lintMigrations([...base, good])).toEqual([])
  })

  it('las reglas de TO/WITH CHECK no se aplican a las migraciones antiguas', () => {
    // remote_schema.sql tiene políticas sin TO; son anteriores a las reglas.
    expect(lintMigrations(base)).toEqual([])
  })
})
