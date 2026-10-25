// ============================================================
// KULTURA — Deriva entre migraciones, tipos y código (F-21, COD-11)
//
// Tres fuentes que tienen que decir lo mismo:
//   1. supabase/migrations/*.sql      → qué tablas, columnas, vistas y
//                                        funciones crea el repo.
//   2. src/types/supabase.ts (bloque   → lo que genera postgres-meta sobre esas
//      `Database`)                       migraciones (scripts/db-diff.sh).
//   3. src/**                          → lo que el código pide a PostgREST:
//                                        `.from('t')`, `.select('…')`, filtros,
//                                        `insert/update/upsert({…})` y `.rpc()`.
//
// Si una migración nueva no regenera los tipos, o el código usa una tabla o
// columna que ninguna migración crea (como pasó con `profiles`), este test
// falla nombrando el archivo y la línea. No sustituye a `scripts/db-diff.sh`,
// que compara con la base real.
// ============================================================

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, it, expect } from 'vitest'

const ROOT = path.resolve(__dirname, '../../..')
const MIGRATIONS_DIR = path.join(ROOT, 'supabase/migrations')
const TYPES_FILE = path.join(ROOT, 'src/types/supabase.ts')

// ------------------------------------------------------------------
// 1. Esquema según las migraciones
// ------------------------------------------------------------------

interface MigrationSchema {
  tables: Map<string, Set<string>>
  views: Set<string>
  /** Funciones de `public` que no son de trigger (las que expone PostgREST). */
  functions: Set<string>
}

/** Quita comentarios y el contenido de literales y cuerpos `$tag$…$tag$` (pueden llevar `;`). */
function blankSql(sql: string): string {
  let out = ''
  let i = 0
  while (i < sql.length) {
    const ch = sql[i]
    const two = sql.slice(i, i + 2)
    if (two === '--') {
      const end = sql.indexOf('\n', i)
      i = end === -1 ? sql.length : end
    } else if (two === '/*') {
      const end = sql.indexOf('*/', i + 2)
      i = end === -1 ? sql.length : end + 2
      out += ' '
    } else if (ch === "'") {
      let j = i + 1
      while (j < sql.length && !(sql[j] === "'" && sql[j + 1] !== "'")) j += sql[j] === "'" ? 2 : 1
      out += "''"
      i = j + 1
    } else if (ch === '$') {
      const tag = /^\$[A-Za-z_]*\$/.exec(sql.slice(i))?.[0]
      if (tag) {
        const end = sql.indexOf(tag, i + tag.length)
        out += ' $body$ '
        i = end === -1 ? sql.length : end + tag.length
      } else {
        out += ch
        i++
      }
    } else {
      out += ch
      i++
    }
  }
  return out
}

/** Divide por comas de primer nivel (fuera de paréntesis). */
function splitTopLevel(s: string): string[] {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(cur)
      cur = ''
    } else cur += ch
  }
  parts.push(cur)
  return parts.map((p) => p.trim()).filter(Boolean)
}

const unquote = (s: string) => s.replace(/"/g, '').toLowerCase()
const QUAL = String.raw`((?:"?\w+"?\s*\.\s*)?"?\w+"?)`

/** Nombre sin esquema si es de `public` (o sin calificar); null si es de otro esquema. */
function publicName(qualified: string): string | null {
  const parts = unquote(qualified).split('.').map((p) => p.trim())
  if (parts.length === 1) return parts[0]
  return parts[0] === 'public' ? parts[1] : null
}

const CONSTRAINT_WORDS = /^(constraint|primary|unique|check|foreign|exclude|like)\b/i

function schemaFromMigrations(files: { name: string; sql: string }[]): MigrationSchema {
  const tables = new Map<string, Set<string>>()
  const views = new Set<string>()
  const functions = new Set<string>()
  for (const { sql } of [...files].sort((a, b) => a.name.localeCompare(b.name))) {
    for (const raw of blankSql(sql).split(';')) {
      const stmt = raw.trim().replace(/\s+/g, ' ')
      let m: RegExpExecArray | null
      if ((m = new RegExp(String.raw`^create (?:unlogged )?table (?:if not exists )?${QUAL} \((.*)\)`, 'i').exec(stmt))) {
        const name = publicName(m[1])
        if (!name) continue
        const cols = tables.get(name) ?? new Set<string>()
        for (const item of splitTopLevel(m[2])) {
          if (!CONSTRAINT_WORDS.test(item)) cols.add(unquote(item.split(' ')[0]))
        }
        tables.set(name, cols)
      } else if ((m = new RegExp(String.raw`^alter table (?:if exists )?(?:only )?${QUAL} (.*)$`, 'i').exec(stmt))) {
        const name = publicName(m[1])
        if (!name) continue
        const rename = /^rename to "?(\w+)"?$/i.exec(m[2])
        if (rename && tables.has(name)) {
          tables.set(rename[1].toLowerCase(), tables.get(name)!)
          tables.delete(name)
          continue
        }
        const cols = tables.get(name)
        if (!cols) continue
        for (const action of splitTopLevel(m[2])) {
          let a: RegExpExecArray | null
          if ((a = /^add (?:column )?(?:if not exists )?("?\w+"?)/i.exec(action)) && !CONSTRAINT_WORDS.test(action.slice(4))) {
            cols.add(unquote(a[1]))
          } else if ((a = /^drop column (?:if exists )?("?\w+"?)/i.exec(action))) {
            cols.delete(unquote(a[1]))
          } else if ((a = /^rename (?:column )?("?\w+"?) to ("?\w+"?)$/i.exec(action))) {
            cols.delete(unquote(a[1]))
            cols.add(unquote(a[2]))
          }
        }
      } else if ((m = /^drop table (?:if exists )?(.*?)(?: cascade| restrict)?$/i.exec(stmt))) {
        for (const t of splitTopLevel(m[1])) {
          const name = publicName(t)
          if (name) tables.delete(name)
        }
      } else if ((m = new RegExp(String.raw`^create (?:or replace )?(?:materialized )?view ${QUAL}`, 'i').exec(stmt))) {
        const name = publicName(m[1])
        if (name) views.add(name)
      } else if ((m = new RegExp(String.raw`^drop (?:materialized )?view (?:if exists )?${QUAL}`, 'i').exec(stmt))) {
        const name = publicName(m[1])
        if (name) views.delete(name)
      } else if ((m = new RegExp(String.raw`^create (?:or replace )?function ${QUAL}\s*\(`, 'i').exec(stmt))) {
        const name = publicName(m[1])
        if (!name) continue
        if (/\breturns "?trigger"?\b/i.test(stmt)) functions.delete(name)
        else functions.add(name)
      } else if ((m = new RegExp(String.raw`^drop function (?:if exists )?${QUAL}`, 'i').exec(stmt))) {
        const name = publicName(m[1])
        if (name) functions.delete(name)
      }
    }
  }
  return { tables, views, functions }
}

// ------------------------------------------------------------------
// 2. Esquema según src/types/supabase.ts (AST de TypeScript)
// ------------------------------------------------------------------

interface TypesSchema {
  /** Tablas y vistas → columnas de `Row`. */
  relations: Map<string, Set<string>>
  tables: Set<string>
  views: Set<string>
  /** Función → nombres de argumentos. */
  functions: Map<string, Set<string>>
  /** Tabla → (columna de la FK o nombre de la FK) → tabla referenciada. */
  foreignKeys: Map<string, Map<string, string>>
}

const propName = (m: ts.TypeElement) => (m.name && (ts.isIdentifier(m.name) || ts.isStringLiteral(m.name)) ? m.name.text : '')

function members(node: ts.TypeNode | undefined): ts.NodeArray<ts.TypeElement> | [] {
  return node && ts.isTypeLiteralNode(node) ? node.members : []
}

function member(node: ts.TypeNode | undefined, name: string): ts.TypeNode | undefined {
  const found = members(node).find((m) => propName(m) === name)
  return found && ts.isPropertySignature(found) ? found.type : undefined
}

const literal = (node: ts.TypeNode | undefined) =>
  node && ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal) ? node.literal.text : undefined

function schemaFromTypes(source: string): TypesSchema {
  const file = ts.createSourceFile('supabase.ts', source, ts.ScriptTarget.Latest, true)
  const db = file.statements.find(
    (s): s is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(s) && s.name.text === 'Database'
  )
  if (!db) throw new Error('src/types/supabase.ts no declara `type Database`')
  const pub = member(db.type, 'public')
  const relations = new Map<string, Set<string>>()
  const foreignKeys = new Map<string, Map<string, string>>()
  const tables = new Set<string>()
  const views = new Set<string>()
  for (const [kind, set] of [['Tables', tables], ['Views', views]] as const) {
    for (const rel of members(member(pub, kind))) {
      const name = propName(rel)
      if (!ts.isPropertySignature(rel) || !name || name.startsWith('[')) continue
      set.add(name)
      relations.set(name, new Set(members(member(rel.type, 'Row')).map(propName)))
      const fks = new Map<string, string>()
      const list = member(rel.type, 'Relationships')
      if (list && ts.isTupleTypeNode(list)) {
        for (const el of list.elements) {
          const ref = literal(member(el, 'referencedRelation'))
          const fkName = literal(member(el, 'foreignKeyName'))
          const cols = member(el, 'columns')
          if (!ref) continue
          if (fkName) fks.set(fkName, ref)
          if (cols && ts.isTupleTypeNode(cols) && cols.elements.length === 1) {
            const col = literal(cols.elements[0])
            if (col) fks.set(col, ref)
          }
        }
      }
      foreignKeys.set(name, fks)
    }
  }
  const functions = new Map<string, Set<string>>()
  for (const fn of members(member(pub, 'Functions'))) {
    const name = propName(fn)
    if (!ts.isPropertySignature(fn) || !name) continue
    const variants = fn.type && ts.isUnionTypeNode(fn.type) ? fn.type.types : [fn.type]
    const args = new Set<string>()
    for (const v of variants) for (const a of members(member(v, 'Args'))) args.add(propName(a))
    functions.set(name, args)
  }
  return { relations, tables, views, functions, foreignKeys }
}

// ------------------------------------------------------------------
// 3. Uso desde el código (AST de cada archivo de src/)
// ------------------------------------------------------------------

/** Métodos de filtro/orden de postgrest-js cuyo primer argumento es una columna. */
const COLUMN_METHODS = new Set([
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'likeAllOf', 'likeAnyOf', 'ilikeAllOf', 'ilikeAnyOf',
  'is', 'in', 'contains', 'containedBy', 'overlaps', 'rangeGt', 'rangeGte', 'rangeLt', 'rangeLte', 'rangeAdjacent',
  'textSearch', 'not', 'filter', 'order',
])
const ROW_METHODS = new Set(['insert', 'update', 'upsert'])

const stringArg = (node: ts.Expression | undefined) =>
  node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined

/** Claves de un objeto literal (o de un array de objetos literales). */
function objectKeys(node: ts.Expression | undefined): string[] {
  if (!node) return []
  if (ts.isArrayLiteralExpression(node)) return node.elements.flatMap((e) => objectKeys(e))
  if (!ts.isObjectLiteralExpression(node)) return []
  return node.properties.flatMap((p) => {
    if (ts.isSpreadAssignment(p)) return []
    if (!p.name) return []
    if (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) return [p.name.text]
    return []
  })
}

/** Comprueba una cadena de `select` de PostgREST (columnas, alias, casts y recursos embebidos). */
function checkSelect(schema: TypesSchema, table: string, select: string, where: string, problems: string[]) {
  const cols = schema.relations.get(table)
  if (!cols) return
  for (let item of splitTopLevel(select.replace(/\s+/g, ' '))) {
    if (item.startsWith('...')) item = item.slice(3).trim()
    const paren = item.indexOf('(')
    if (paren >= 0) {
      const head = item.slice(0, paren)
      const inner = item.slice(paren + 1, item.lastIndexOf(')'))
      const target = (head.includes(':') ? head.slice(head.lastIndexOf(':') + 1) : head).split('!')
      let rel = target[0].trim()
      if (rel === 'count') continue
      const fks = schema.foreignKeys.get(table)
      if (!schema.relations.has(rel)) rel = fks?.get(rel) ?? (target[1] ? fks?.get(target[1].trim()) ?? rel : rel)
      if (!schema.relations.has(rel)) {
        problems.push(`${where}: \`${table}\` no tiene relación con \`${target[0].trim()}\``)
        continue
      }
      checkSelect(schema, rel, inner, where, problems)
      continue
    }
    let col = item.replace(/::\w+(\[\])?/g, '')
    if (/^\w+\s*:(?!:)/.test(col)) col = col.slice(col.indexOf(':') + 1)
    col = col.split('->')[0].trim()
    if (col === '*' || col === 'count' || col === '') continue
    if (!cols.has(col)) problems.push(`${where}: la columna \`${table}.${col}\` no existe`)
  }
}

interface SourceFile {
  name: string
  text: string
}

interface Usage {
  problems: string[]
  tables: Set<string>
  functions: Set<string>
  /** Llamadas `.from(<expresión>)` con nombre de tabla dinámico (no se pueden comprobar aquí). */
  dynamic: string[]
}

function scanUsage(files: SourceFile[], schema: TypesSchema): Usage {
  const problems: string[] = []
  const tables = new Set<string>()
  const functions = new Set<string>()
  const dynamic: string[] = []
  for (const { name, text } of files) {
    const sf = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, name.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const at = (n: ts.Node) => `${name}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text
        const receiver = node.expression.expression
        const receiverName = ts.isIdentifier(receiver)
          ? receiver.text
          : ts.isPropertyAccessExpression(receiver)
            ? receiver.name.text
            : ''
        if (method === 'rpc') {
          const fn = stringArg(node.arguments[0])
          if (fn) {
            functions.add(fn)
            const args = schema.functions.get(fn)
            if (!args) problems.push(`${at(node)}: la función \`${fn}\` no existe en los tipos`)
            else for (const k of objectKeys(node.arguments[1])) if (!args.has(k)) problems.push(`${at(node)}: \`${fn}\` no tiene el argumento \`${k}\``)
          }
        } else if (method === 'from' && !['Array', 'Buffer', 'Uint8Array', 'storage', 'Object'].includes(receiverName)) {
          const table = stringArg(node.arguments[0])
          if (table === undefined) {
            if (node.arguments.length === 1) dynamic.push(at(node))
          } else {
            tables.add(table)
            if (!schema.relations.has(table)) {
              problems.push(`${at(node)}: la tabla \`${table}\` no existe en las migraciones`)
            } else {
              // Sube por la cadena: .from('t').select(…).eq(…).order(…)…
              let cur: ts.Node = node
              while (ts.isPropertyAccessExpression(cur.parent) && ts.isCallExpression(cur.parent.parent)) {
                const call = cur.parent.parent
                const m = cur.parent.name.text
                const here = at(cur.parent.name)
                const first = call.arguments[0]
                const has = (t: string, c: string) => schema.relations.get(t)?.has(c) ?? false
                if (m === 'select') {
                  const sel = stringArg(first)
                  if (sel !== undefined) checkSelect(schema, table, sel, here, problems)
                } else if (COLUMN_METHODS.has(m)) {
                  const col = stringArg(first)
                  // `rel(col)` ordena por un recurso embebido; `rel.col` filtra uno: se
                  // comprueba la columna en la tabla relacionada si se puede resolver.
                  const embedded = col ? /^(\w+)[.(](\w+)\)?$/.exec(col) : null
                  if (embedded) {
                    const rel = schema.relations.has(embedded[1]) ? embedded[1] : schema.foreignKeys.get(table)?.get(embedded[1])
                    if (rel && !has(rel, embedded[2])) problems.push(`${here}: \`.${m}('${col}')\` sobre \`${table}\`, columna inexistente`)
                  } else if (col && !col.includes('->') && !has(table, col)) {
                    problems.push(`${here}: \`.${m}('${col}')\` sobre \`${table}\`, columna inexistente`)
                  }
                } else if (m === 'match') {
                  for (const k of objectKeys(first)) if (!has(table, k)) problems.push(`${here}: \`.match\` con \`${table}.${k}\` inexistente`)
                }
                if (ROW_METHODS.has(m)) {
                  for (const k of objectKeys(first)) {
                    if (!has(table, k)) problems.push(`${here}: \`.${m}\` escribe \`${table}.${k}\`, columna inexistente`)
                  }
                  const onConflict = call.arguments[1] && ts.isObjectLiteralExpression(call.arguments[1])
                    ? call.arguments[1].properties.find((p) => p.name && ts.isIdentifier(p.name) && p.name.text === 'onConflict')
                    : undefined
                  const conflict = onConflict && ts.isPropertyAssignment(onConflict) ? stringArg(onConflict.initializer) : undefined
                  for (const c of (conflict ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
                    if (!has(table, c)) problems.push(`${here}: \`onConflict\` con \`${table}.${c}\` inexistente`)
                  }
                }
                cur = call
              }
            }
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
  }
  return { problems, tables, functions, dynamic }
}

// ------------------------------------------------------------------
// Datos reales del repo
// ------------------------------------------------------------------

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) && !f.endsWith('.d.ts') ? [p] : []
  })

const migrations = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .map((name) => ({ name, sql: readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8') }))
const fromMigrations = schemaFromMigrations(migrations)
const fromTypes = schemaFromTypes(readFileSync(TYPES_FILE, 'utf8'))
const sources: SourceFile[] = walk(path.join(ROOT, 'src')).map((p) => ({
  name: path.relative(ROOT, p),
  text: readFileSync(p, 'utf8'),
}))
const usage = scanUsage(sources, fromTypes)

const sorted = (s: Iterable<string>) => Array.from(s).sort()

describe('esquema: migraciones ↔ src/types/supabase.ts', () => {
  it('las mismas tablas (si falla: scripts/db-diff.sh --gen-types tras la migración nueva)', () => {
    expect(sorted(fromTypes.tables)).toEqual(sorted(fromMigrations.tables.keys()))
  })

  it('las mismas columnas en cada tabla', () => {
    const drift: Record<string, { soloMigraciones: string[]; soloTipos: string[] }> = {}
    for (const [table, cols] of Array.from(fromMigrations.tables)) {
      const typed = fromTypes.relations.get(table) ?? new Set<string>()
      const soloMigraciones = sorted(cols).filter((c) => !typed.has(c))
      const soloTipos = sorted(typed).filter((c) => !cols.has(c))
      if (soloMigraciones.length || soloTipos.length) drift[table] = { soloMigraciones, soloTipos }
    }
    expect(drift).toEqual({})
  })

  it('las mismas vistas y funciones RPC', () => {
    expect(sorted(fromTypes.views)).toEqual(sorted(fromMigrations.views))
    expect(sorted(fromTypes.functions.keys())).toEqual(sorted(fromMigrations.functions))
  })

  it('incluye las tablas de las migraciones recientes (moderación, identidad, IA, analítica)', () => {
    for (const t of ['blocks', 'group_bans', 'account_state', 'username_history', 'ai_usage', 'ai_recs', 'analytics_events', 'media_translations']) {
      expect(fromTypes.tables.has(t), t).toBe(true)
    }
    expect(fromTypes.views.has('funnel_weekly')).toBe(true)
    expect(fromTypes.relations.get('users')?.has('library_visibility')).toBe(true)
    expect(fromTypes.relations.get('reports')?.has('resolved_at')).toBe(true)
    expect(fromTypes.relations.get('list_members')?.has('added_at')).toBe(true)
  })
})

describe('esquema: código ↔ tipos', () => {
  it('todo `.from()`, `.select()`, filtro, escritura y `.rpc()` de src/ usa tablas, columnas y funciones que existen', () => {
    expect(usage.problems).toEqual([])
  })

  it('el escaneo ve de verdad el código (no pasa en vacío)', () => {
    expect(usage.tables.size).toBeGreaterThanOrEqual(20)
    expect(usage.tables.has('user_media')).toBe(true)
    expect(usage.functions.has('create_conversation_with_members')).toBe(true)
  })

  it('las tablas con nombre dinámico están acotadas a las conocidas', () => {
    // collect.ts (export RGPD) y reports/shared.ts reciben el nombre por
    // variable; sus literales de tabla también tienen que existir.
    expect(usage.dynamic.map((d) => d.split(':')[0]).sort()).toEqual(
      ['src/app/api/account/export/collect.ts', 'src/app/api/account/export/collect.ts', 'src/app/api/reports/shared.ts'].sort()
    )
    const collect = sources.find((s) => s.name === 'src/app/api/account/export/collect.ts')!.text
    const shared = sources.find((s) => s.name === 'src/app/api/reports/shared.ts')!.text
    const problems: string[] = []
    // q('tabla', 'col, col', 'columna_filtro') y fetchIn(admin, 'tabla', 'cols', 'columna', …)
    const calls = Array.from(collect.matchAll(/\b(?:q|fetchIn\(\s*admin\s*,)\s*\(?\s*'(\w+)',\s*'([^']*)',\s*'(\w+)'/g))
    expect(calls.length).toBeGreaterThanOrEqual(10)
    for (const m of calls) {
      const [, table, cols, filter] = m
      if (!fromTypes.relations.has(table)) problems.push(`collect.ts: tabla ${table}`)
      else {
        checkSelect(fromTypes, table, cols, 'collect.ts', problems)
        if (!fromTypes.relations.get(table)!.has(filter)) problems.push(`collect.ts: ${table}.${filter}`)
      }
    }
    const map = /const table = \{([\s\S]*?)\}\[type\]/.exec(shared)?.[1] ?? ''
    const mapped = Array.from(map.matchAll(/:\s*'(\w+)'/g)).map((m) => m[1])
    expect(mapped.length).toBeGreaterThan(0)
    for (const t of mapped) if (!fromTypes.relations.has(t)) problems.push(`reports/shared.ts: tabla ${t}`)
    expect(problems).toEqual([])
  })
})

describe('esquema: el detector detecta', () => {
  const schema = schemaFromTypes(readFileSync(TYPES_FILE, 'utf8'))
  const scan = (text: string) => scanUsage([{ name: 'x.ts', text }], schema).problems

  it('una tabla que ninguna migración crea (el caso de `profiles`)', () => {
    expect(scan(`await supabase.from('profiles').select('id', { count: 'exact', head: true })`)).toEqual([
      'x.ts:1: la tabla `profiles` no existe en las migraciones',
    ])
  })

  it('columnas inexistentes en select, filtros, escrituras, onConflict y recursos embebidos', () => {
    const problems = scan(`
      await db.from('users')
        .select('id, nombre, avatar:avatar_icon, friends:friendships!friendships_requester_id_fkey(id, nope)')
        .eq('usernam', 'x')
        .order('created', { ascending: false })
      await db.from('user_media').upsert({ user_id: u, media_id: m, estrellas: 5 }, { onConflict: 'user_id,media' })
      await db.from('friendships').select('requester:requester_id(id, apodo)')
      await db.from('conversation_members').select('conversation_id').order('conversations(ultimo)')
    `)
    expect(problems).toEqual([
      'x.ts:3: la columna `users.nombre` no existe',
      'x.ts:3: la columna `friendships.nope` no existe',
      'x.ts:4: `.eq(\'usernam\')` sobre `users`, columna inexistente',
      'x.ts:5: `.order(\'created\')` sobre `users`, columna inexistente',
      'x.ts:6: `.upsert` escribe `user_media.estrellas`, columna inexistente',
      'x.ts:6: `onConflict` con `user_media.media` inexistente',
      'x.ts:7: la columna `users.apodo` no existe',
      "x.ts:8: `.order('conversations(ultimo)')` sobre `conversation_members`, columna inexistente",
    ])
  })

  it('funciones RPC y argumentos inexistentes', () => {
    expect(scan(`await db.rpc('can_read_library', { owner: id }); await db.rpc('get_discoverable_groups')`)).toEqual([
      'x.ts:1: `can_read_library` no tiene el argumento `owner`',
      'x.ts:1: la función `get_discoverable_groups` no existe en los tipos',
    ])
  })

  it('no confunde Array.from, Buffer.from ni storage.from con tablas', () => {
    expect(scan(`Array.from('abc'); Buffer.from('x'); supabase.storage.from('avatars').upload(p, f)`)).toEqual([])
  })

  it('una migración que añade una columna sin regenerar los tipos', () => {
    const withNew = schemaFromMigrations([
      ...migrations,
      { name: '29991231000001_x.sql', sql: `alter table public.users add column if not exists apodo text;\ncreate table if not exists public.nueva (id uuid primary key, "valor" text not null, constraint c check (true));` },
    ])
    expect(withNew.tables.get('users')?.has('apodo')).toBe(true)
    expect(sorted(withNew.tables.get('nueva')!)).toEqual(['id', 'valor'])
    expect(fromTypes.relations.get('users')?.has('apodo')).toBe(false)
  })

  it('el SQL de cuerpos de función y literales no rompe el troceado', () => {
    const s = schemaFromMigrations([
      {
        name: '1_x.sql',
        sql: `create table public.t (a int, b text default 'x;y', "c" jsonb);
create or replace function public.f() returns void language plpgsql as $f$ begin alter table public.t add column z int; end $f$;
create function public.trg() returns trigger language plpgsql as $$ begin return new; end $$;
alter table only "public"."t" add column if not exists "d" date, drop column b;`,
      },
    ])
    expect(sorted(s.tables.get('t')!)).toEqual(['a', 'c', 'd'])
    expect(sorted(s.functions)).toEqual(['f'])
  })
})
