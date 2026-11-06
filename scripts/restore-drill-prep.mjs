// Simulacro de restauración sin Docker ni proyecto de test (F0, R10):
// prepara un PostgreSQL vacío para cargar el volcado de `backup.yml`.
// Uso: node scripts/restore-drill-prep.mjs <carpeta con plain/data.sql>
// Genera stub.sql (roles y auth mínimos de Supabase) y data_public.sql
// (solo los COPY de public.* y auth.users). Ver supabase/README.md.
import fs from 'node:fs'
const D = process.argv[2]
const data = fs.readFileSync(D + '/plain/data.sql', 'utf8').replace(/\r\n/g, '\n')

const hdr = data
  .match(/^COPY "auth"\."users" \(([^)]*)\)/m)[1]
  .split(',')
  .map((s) => s.trim().replace(/"/g, ''))
const typ = (c) =>
  c === 'id' ? 'uuid primary key'
  : /meta_data$/.test(c) ? 'jsonb'
  : /_at$|_until$/.test(c) ? 'timestamptz'
  : ['is_super_admin', 'is_sso_user', 'is_anonymous'].includes(c) ? 'boolean'
  : c === 'email_change_confirm_status' ? 'smallint'
  : 'text'

const roles = ['anon', 'authenticated', 'authenticator', 'service_role', 'supabase_admin',
  'supabase_auth_admin', 'supabase_storage_admin', 'dashboard_user', 'pgbouncer',
  'supabase_realtime_admin', 'supabase_replication_admin', 'supabase_read_only_user']
let stub = roles
  .map((r) => `do $$ begin create role "${r}" nologin; exception when duplicate_object then null; end $$;`)
  .join('\n')
stub += `
create schema if not exists extensions;
create schema if not exists vault;
create schema if not exists auth;
create schema if not exists storage;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create or replace function auth.email() returns text language sql stable as $$ select auth.jwt()->>'email' $$;
create table auth.users (${hdr.map((c) => `"${c}" ${typ(c)}`).join(', ')});
`
fs.writeFileSync(D + '/stub.sql', stub)

const out = []
let keep = null
for (const l of data.split('\n')) {
  if (keep === null) {
    const m = l.match(/^COPY "(\w+)"\."(\w+)"/)
    if (m) {
      keep = m[1] === 'public' || (m[1] === 'auth' && m[2] === 'users')
      if (keep) out.push(l)
      continue
    }
    if (/^SET /.test(l)) out.push(l)
    if (/^SELECT pg_catalog\.setval\('"public"/.test(l)) out.push(l)
  } else {
    if (keep) out.push(l)
    if (l === '\\.') keep = null
  }
}
fs.writeFileSync(D + '/data_public.sql', out.join('\n') + '\n')
console.log('cols', hdr.length, 'copies', out.filter((l) => l.startsWith('COPY')).length)
