/**
 * Base en memoria con lo mínimo del cliente de Supabase que usan las rutas y
 * el envío de push: select/eq/neq/in/gte/lte/order/limit/maybeSingle, insert, upsert
 * (onConflict), update y delete (con `.select()` para RETURNING). Cada
 * llamada queda en `log` para comprobar qué se pidió.
 */
type Row = Record<string, unknown>

export interface FakeDb {
  tables: Record<string, Row[]>
  log: { table: string; op: string; filters: string[]; values?: unknown }[]
  /** Error forzado por tabla (p. ej. tabla sin migrar). */
  errors: Record<string, { code: string; message: string } | undefined>
  /** Columnas que aún no existen por tabla: un select que las pida da 42703. */
  missingColumns: Record<string, string[] | undefined>
  from: (table: string) => Query
}

class Query implements PromiseLike<{ data: unknown; error: unknown; count?: number }> {
  private filters: ((r: Row) => boolean)[] = []
  private filterLog: string[] = []
  private op: 'select' | 'update' | 'delete' | 'upsert' | 'insert' = 'select'
  private values: Row | Row[] | null = null
  private conflict: string | null = null
  private orderBy: { col: string; asc: boolean }[] = []
  private columns = '*'
  private max: number | null = null
  private single = false
  private returning = false

  constructor(private db: FakeDb, private table: string) {}

  select(columns = '*') {
    if (this.op !== 'select') this.returning = true
    else this.columns = columns
    return this
  }
  insert(values: Row | Row[]) {
    this.op = 'insert'
    this.values = values
    return this
  }
  upsert(values: Row, opts: { onConflict?: string } = {}) {
    this.op = 'upsert'
    this.values = values
    this.conflict = opts.onConflict ?? 'id'
    return this
  }
  update(values: Row) {
    this.op = 'update'
    this.values = values
    return this
  }
  delete() {
    this.op = 'delete'
    return this
  }
  eq(col: string, v: unknown) {
    this.filters.push((r) => r[col] === v)
    this.filterLog.push(`${col}=${String(v)}`)
    return this
  }
  neq(col: string, v: unknown) {
    this.filters.push((r) => r[col] !== v)
    this.filterLog.push(`${col}!=${String(v)}`)
    return this
  }
  in(col: string, vs: unknown[]) {
    this.filters.push((r) => vs.includes(r[col]))
    this.filterLog.push(`${col} in ${vs.join(',')}`)
    return this
  }
  gte(col: string, v: unknown) {
    this.filters.push((r) => r[col] != null && String(r[col]) >= String(v))
    this.filterLog.push(`${col}>=${String(v)}`)
    return this
  }
  lte(col: string, v: unknown) {
    this.filters.push((r) => r[col] != null && String(r[col]) <= String(v))
    this.filterLog.push(`${col}<=${String(v)}`)
    return this
  }
  is(col: string, v: unknown) {
    this.filters.push((r) => (r[col] ?? null) === v)
    return this
  }
  order(col: string, opts: { ascending?: boolean } = {}) {
    this.orderBy.push({ col, asc: opts.ascending !== false })
    return this
  }
  limit(n: number) {
    this.max = n
    return this
  }
  maybeSingle() {
    this.single = true
    return this
  }

  private run() {
    const error = this.db.errors[this.table]
    this.db.log.push({ table: this.table, op: this.op, filters: this.filterLog, values: this.values ?? undefined })
    if (error) return { data: null, error }
    const missing = (this.db.missingColumns[this.table] ?? []).find((c) =>
      this.columns.split(',').map((x) => x.trim()).includes(c),
    )
    if (missing) return { data: null, error: { code: '42703', message: `column ${this.table}.${missing} does not exist` } }
    const rows = (this.db.tables[this.table] ??= [])
    const match = (r: Row) => this.filters.every((f) => f(r))
    if (this.op === 'insert' || this.op === 'upsert') {
      const list = Array.isArray(this.values) ? this.values : [this.values!]
      for (const v of list) {
        const key = this.conflict
        const existing = key ? rows.find((r) => r[key] === v[key]) : undefined
        if (existing && this.op === 'upsert') Object.assign(existing, v)
        else rows.push({ id: `id-${rows.length + 1}-${Math.random().toString(36).slice(2, 6)}`, ...v })
      }
      return { data: null, error: null }
    }
    if (this.op === 'update') {
      const hit = rows.filter(match)
      hit.forEach((r) => Object.assign(r, this.values))
      return { data: this.returning ? hit : null, error: null }
    }
    if (this.op === 'delete') {
      const hit = rows.filter(match)
      this.db.tables[this.table] = rows.filter((r) => !match(r))
      return { data: this.returning ? hit : null, error: null }
    }
    let out = rows.filter(match)
    if (this.orderBy.length > 0) {
      out = [...out].sort((a, b) => {
        for (const { col, asc } of this.orderBy) {
          const d = String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0
          if (d !== 0) return d * (asc ? 1 : -1)
        }
        return 0
      })
    }
    if (this.max !== null) out = out.slice(0, this.max)
    if (this.single) return { data: out[0] ?? null, error: null }
    return { data: out, error: null }
  }

  then<A = { data: unknown; error: unknown }, B = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown }) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected)
  }
}

export function fakeDb(tables: Record<string, Row[]> = {}): FakeDb {
  const db: FakeDb = {
    tables,
    log: [],
    errors: {},
    missingColumns: {},
    from: (table: string) => new Query(db, table),
  }
  return db
}
