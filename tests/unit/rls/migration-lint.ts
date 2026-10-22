// ============================================================
// KULTURA — Revisión estática de las migraciones de Supabase (F-02)
//
// Sin base de datos: lee los .sql en orden y comprueba reglas que, si se
// rompen, abren la RLS sin que nadie se entere:
//   1. Toda tabla creada en `public` activa RLS.
//   2. Toda tabla con alguna política PERMISIVA de escritura (insert, update,
//      delete o all) queda cubierta por el bloque `demo_no_*` (el bucle de
//      20261008000001_demo_read_only.sql), es decir, ese bloque se ejecuta
//      DESPUÉS de crear la tabla. Si una migración crea una tabla con
//      escritura, tiene que volver a ejecutar el bloque al final.
//   3. En las migraciones nuevas (desde NEW_RULES_FROM): toda política lleva
//      `TO <rol>`, toda política UPDATE/ALL lleva `WITH CHECK`, y toda función
//      SECURITY DEFINER se revoca a PUBLIC en el mismo archivo (el EXECUTE para
//      PUBLIC es un privilegio por defecto global que no se puede quitar por
//      esquema).
// La comprobación contra la base real está en tests/integration/rls
// (public.rls_audit()).
// ============================================================

export const NEW_RULES_FROM = '20261023'

export interface Migration {
  name: string
  sql: string
}

interface Pos {
  file: number
  offset: number
}

const before = (a: Pos, b: Pos) => a.file < b.file || (a.file === b.file && a.offset < b.offset)

/** Quita comentarios `-- …` y `/* … *\/` (no hay comentarios dentro de cadenas en el repo). */
export function stripComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ')
}

const ident = String.raw`"?([A-Za-z_][\w%]*)"?`
const publicQual = String.raw`(?:"?public"?\s*\.\s*)`

interface Policy {
  name: string
  table: string
  cmd: 'select' | 'insert' | 'update' | 'delete' | 'all'
  restrictive: boolean
  hasTo: boolean
  hasWithCheck: boolean
  pos: Pos
  migration: string
}

function parsePolicies(sql: string, file: number, migration: string): Policy[] {
  const re = new RegExp(
    String.raw`create\s+policy\s+("[^"]+"|\w+)\s+on\s+${publicQual}?${ident}([\s\S]*?);`,
    'gi',
  )
  const out: Policy[] = []
  for (const m of Array.from(sql.matchAll(re))) {
    const body = m[3]
    const head = body.split(/\b(?:using|with\s+check)\b/i)[0]
    const cmd = (head.match(/\bfor\s+(select|insert|update|delete|all)\b/i)?.[1]?.toLowerCase() ??
      'all') as Policy['cmd']
    out.push({
      name: m[1].replace(/"/g, ''),
      table: m[2],
      cmd,
      restrictive: /\bas\s+restrictive\b/i.test(head),
      hasTo: /\bto\s+["\w]/i.test(head),
      hasWithCheck: /\bwith\s+check\b/i.test(body),
      pos: { file, offset: m.index ?? 0 },
      migration,
    })
  }
  return out
}

interface DefinerFn {
  name: string
  migration: string
}

/** Funciones `security definer` de un archivo (los atributos pueden ir antes o después del cuerpo). */
function parseDefinerFunctions(sql: string, migration: string): DefinerFn[] {
  const out: DefinerFn[] = []
  const re = /create\s+(?:or\s+replace\s+)?function\s+([\w."]+)\s*\(/gi
  for (const m of Array.from(sql.matchAll(re))) {
    const start = (m.index ?? 0) + m[0].length
    const open = sql.slice(start).match(/\$(\w*)\$/)
    if (!open || open.index === undefined) continue
    const bodyStart = start + open.index + open[0].length
    const closeAt = sql.indexOf(open[0], bodyStart)
    if (closeAt === -1) continue
    const end = sql.indexOf(';', closeAt)
    const header = sql.slice(start, start + open.index) + sql.slice(closeAt, end === -1 ? undefined : end)
    if (/security\s+definer/i.test(header)) {
      out.push({ name: m[1].replace(/"/g, '').replace(/^public\./i, ''), migration })
    }
  }
  return out
}

export function lintMigrations(migrations: Migration[]): string[] {
  const problems: string[] = []
  const sorted = [...migrations].sort((a, b) => a.name.localeCompare(b.name))
  const created = new Map<string, { pos: Pos; migration: string }>()
  const rls = new Set<string>()
  const demoBlocks: Pos[] = []
  const policies: Policy[] = []

  sorted.forEach((mig, file) => {
    const sql = stripComments(mig.sql)

    const tableRe = new RegExp(String.raw`create\s+table\s+(?:if\s+not\s+exists\s+)?${publicQual}${ident}`, 'gi')
    for (const m of Array.from(sql.matchAll(tableRe))) {
      if (!created.has(m[1])) created.set(m[1], { pos: { file, offset: m.index ?? 0 }, migration: mig.name })
    }
    const rlsRe = new RegExp(
      String.raw`alter\s+table\s+(?:only\s+)?(?:if\s+exists\s+)?${publicQual}${ident}\s+enable\s+row\s+level\s+security`,
      'gi',
    )
    for (const m of Array.from(sql.matchAll(rlsRe))) rls.add(m[1])

    for (const m of Array.from(sql.matchAll(/relrowsecurity[\s\S]*?create\s+policy\s+demo_no_insert/gi))) {
      demoBlocks.push({ file, offset: m.index ?? 0 })
    }

    policies.push(...parsePolicies(sql, file, mig.name))

    if (mig.name >= NEW_RULES_FROM) {
      for (const p of parsePolicies(sql, file, mig.name)) {
        if (p.table.includes('%')) continue // políticas dinámicas del bucle demo (llevan TO)
        if (!p.hasTo) problems.push(`${mig.name}: la política "${p.name}" de ${p.table} no lleva TO <rol>`)
        if ((p.cmd === 'update' || p.cmd === 'all') && !p.restrictive && !p.hasWithCheck) {
          problems.push(`${mig.name}: la política "${p.name}" (${p.cmd}) de ${p.table} no lleva WITH CHECK`)
        }
      }
      for (const fn of parseDefinerFunctions(sql, mig.name)) {
        const revoke = new RegExp(
          String.raw`revoke\s+(?:all|execute)[^;]*on\s+function\s+(?:public\.)?"?${fn.name}"?\s*\([^;]*from\s+[^;]*\bpublic\b`,
          'i',
        )
        if (!revoke.test(sql)) {
          problems.push(`${mig.name}: la función SECURITY DEFINER ${fn.name} no se revoca a PUBLIC`)
        }
      }
    }
  })

  for (const [table, info] of Array.from(created)) {
    if (!rls.has(table)) problems.push(`${info.migration}: la tabla ${table} no activa RLS`)
  }

  const writable = new Set(
    policies
      .filter((p) => !p.restrictive && p.cmd !== 'select' && !p.table.includes('%'))
      .map((p) => p.table),
  )
  for (const table of Array.from(writable)) {
    const info = created.get(table)
    if (!info) continue // tabla fuera de las migraciones (no debería pasar)
    if (!demoBlocks.some((d) => before(info.pos, d))) {
      problems.push(
        `${info.migration}: la tabla ${table} admite escritura de authenticated y ningún bloque demo_no_* se ejecuta después de crearla`,
      )
    }
  }
  return problems
}
