// Saneamiento 12.2: seguridad de la base comprobada en el CI.
//
// Contra el Supabase local del job CUJ (todas las migraciones aplicadas),
// falla si:
//   1. public.rls_audit() da alguna tabla que no está ok (RLS apagada,
//      escritura sin las políticas demo_no_*, o INSERT/UPDATE sin WITH CHECK);
//   2. hay una vista de public sin security_invoker (se saltaría la RLS);
//   3. una función SECURITY DEFINER de public la puede ejecutar anon o
//      authenticated y no está en supabase/security-allowlist.json, o al revés
//      (una de la lista ya no lo está: hay que quitarla).
// Es lo mismo que miran los avisos de seguridad de Supabase (lints 0010, 0013,
// 0028 y 0029), pero sobre las migraciones del PR, antes de llegar a ninguna
// base real.
//
// Uso: node scripts/check-db-security.mjs postgresql://postgres:postgres@127.0.0.1:54322/postgres
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ALLOWLIST = 'supabase/security-allowlist.json'

const QUERY = `
select json_build_object(
  'rls', (select coalesce(json_agg(tabla order by tabla), '[]') from public.rls_audit() where not ok),
  'views', (select coalesce(json_agg(c.relname order by c.relname), '[]')
              from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relkind in ('v', 'm')
               and not coalesce((select option_value = 'true' from pg_options_to_table(c.reloptions)
                                  where option_name = 'security_invoker'), false)),
  'definer', (select coalesce(json_agg(json_build_object(
                 'fn', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
                 'anon', has_function_privilege('anon', p.oid, 'EXECUTE'),
                 'authenticated', has_function_privilege('authenticated', p.oid, 'EXECUTE'))), '[]')
                from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.prosecdef
                 and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e'))
)`

/**
 * state: { rls: string[], views: string[], definer: [{ fn, anon, authenticated }] }
 * allow: { anon: string[], authenticated: string[] }
 * Devuelve la lista de problemas (vacía si todo bien).
 */
export function checkDbSecurity(state, allow) {
  const problems = []
  for (const t of state.rls) problems.push(`rls_audit(): la tabla ${t} no está ok`)
  for (const v of state.views) problems.push(`la vista ${v} no tiene security_invoker (se salta la RLS)`)
  for (const role of ['anon', 'authenticated']) {
    const actual = new Set(state.definer.filter((d) => d[role]).map((d) => d.fn))
    const allowed = new Set(allow[role] ?? [])
    for (const fn of actual) {
      if (!allowed.has(fn)) {
        problems.push(`${role} puede ejecutar la función SECURITY DEFINER ${fn} (llamable por /rest/v1/rpc). Quita el EXECUTE o añádela a ${ALLOWLIST} con motivo`)
      }
    }
    for (const fn of allowed) {
      if (!actual.has(fn)) problems.push(`${ALLOWLIST}: ${role} ya no ejecuta ${fn}; quítala de la lista`)
    }
  }
  return problems
}

function main() {
  const url = process.argv[2]
  if (!url) {
    console.error('Uso: node scripts/check-db-security.mjs <postgresql://… de una base con todas las migraciones>')
    process.exit(2)
  }
  const allow = JSON.parse(fs.readFileSync(ALLOWLIST, 'utf8'))
  const raw = execFileSync('psql', [url, '-AtX', '-v', 'ON_ERROR_STOP=1', '-c', QUERY], { encoding: 'utf8' })
  const state = JSON.parse(raw)
  const problems = checkDbSecurity(state, allow)
  if (problems.length > 0) {
    for (const p of problems) console.error(`::error::${p}`)
    process.exit(1)
  }
  console.log(`OK: rls_audit() sin fallos, ${state.definer.length} funciones SECURITY DEFINER revisadas, vistas con security_invoker.`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
