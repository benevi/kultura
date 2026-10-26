// ============================================================
// KULTURA — Supabase en memoria para los tests del catálogo `media`
//
// El cliente del usuario y el cliente admin comparten el MISMO almacén, como en
// la base real: así un test puede comprobar qué escribe cada uno y si una fila
// existente cambia o no. Solo implementa lo que usan las rutas de este frente:
// select/eq/in/or/order/range/maybeSingle/single, insert, upsert (con
// `onConflict` e `ignoreDuplicates`), update y delete.
// ============================================================

type Row = Record<string, unknown>
type Filter = (row: Row) => boolean

export interface FakeDb {
  tables: Record<string, Row[]>
  /** Escrituras registradas por cliente (`user` | `admin`) y tabla. */
  writes: Array<{ client: string; table: string; op: string; payload: unknown }>
  /** Tablas que responden con este error en cualquier operación. */
  failures: Record<string, { code?: string; message: string }>
}

export function createFakeDb(initial: Record<string, Row[]> = {}): FakeDb {
  const tables: Record<string, Row[]> = {}
  for (const [name, rows] of Object.entries(initial)) tables[name] = rows.map((r) => ({ ...r }))
  return { tables, writes: [], failures: {} }
}

function keyOf(row: Row, cols: string[]): string {
  return cols.map((c) => String(row[c])).join('|')
}

/** Parser mínimo de `.or('a.eq.x,b.eq.y')`. */
function parseOr(expr: string): Filter {
  const parts = expr.split(',').map((p) => {
    const [col, op, ...rest] = p.split('.')
    const value = rest.join('.')
    if (op !== 'eq') throw new Error(`fake-supabase: or() solo admite eq (${p})`)
    return (row: Row) => String(row[col]) === value
  })
  return (row) => parts.some((f) => f(row))
}

class Query implements PromiseLike<{ data: unknown; error: unknown; count?: number | null }> {
  private filters: Filter[] = []
  private op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select'
  private payload: Row[] | Row | null = null
  private opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}
  private returning = false
  private mode: 'many' | 'single' | 'maybeSingle' = 'many'
  private from_ = 0
  private to_ = Infinity
  private orderCol: string | null = null

  constructor(
    private db: FakeDb,
    private table: string,
    private client: string
  ) {}

  select(cols?: string) {
    void cols // las columnas no se filtran: los tests comparan filas completas
    if (this.op !== 'select') this.returning = true
    return this
  }
  insert(rows: Row | Row[]) {
    this.op = 'insert'
    this.payload = rows
    return this
  }
  upsert(rows: Row | Row[], opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
    this.op = 'upsert'
    this.payload = rows
    this.opts = opts
    return this
  }
  update(patch: Row) {
    this.op = 'update'
    this.payload = patch
    return this
  }
  delete() {
    this.op = 'delete'
    return this
  }
  eq(col: string, value: unknown) {
    this.filters.push((row) => row[col] === value)
    return this
  }
  neq(col: string, value: unknown) {
    this.filters.push((row) => row[col] !== value)
    return this
  }
  in(col: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[col]))
    return this
  }
  or(expr: string) {
    this.filters.push(parseOr(expr))
    return this
  }
  match(obj: Row) {
    for (const [k, v] of Object.entries(obj)) this.eq(k, v)
    return this
  }
  order(col: string) {
    this.orderCol = col
    return this
  }
  range(from: number, to: number) {
    this.from_ = from
    this.to_ = to
    return this
  }
  limit(n: number) {
    this.to_ = this.from_ + n - 1
    return this
  }
  maybeSingle() {
    this.mode = 'maybeSingle'
    return this
  }
  single() {
    this.mode = 'single'
    return this
  }

  then<T1 = { data: unknown; error: unknown }, T2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown; count?: number | null }) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null
  ): PromiseLike<T1 | T2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected)
  }

  private run(): { data: unknown; error: unknown; count?: number | null } {
    const failure = this.db.failures[this.table]
    if (failure) return { data: null, error: failure }

    const rows = (this.db.tables[this.table] ??= [])
    const matches = (row: Row) => this.filters.every((f) => f(row))

    if (this.op !== 'select') {
      this.db.writes.push({ client: this.client, table: this.table, op: this.op, payload: this.payload })
    }

    let result: Row[] = []
    if (this.op === 'select') {
      result = rows.filter(matches)
      if (this.orderCol) {
        const col = this.orderCol
        result = [...result].sort((a, b) => String(a[col]).localeCompare(String(b[col])))
      }
      result = result.slice(this.from_, this.to_ + 1)
    } else if (this.op === 'insert') {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload as Row]
      for (const r of list) rows.push({ ...r })
      result = list
    } else if (this.op === 'upsert') {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload as Row]
      const cols = (this.opts.onConflict ?? 'id').split(',').map((c) => c.trim())
      for (const r of list) {
        const idx = rows.findIndex((existing) => keyOf(existing, cols) === keyOf(r, cols))
        if (idx === -1) {
          rows.push({ ...r })
          result.push(r)
        } else if (!this.opts.ignoreDuplicates) {
          rows[idx] = { ...rows[idx], ...r }
          result.push(rows[idx])
        }
      }
    } else if (this.op === 'update') {
      for (let i = 0; i < rows.length; i++) {
        if (matches(rows[i])) {
          rows[i] = { ...rows[i], ...(this.payload as Row) }
          result.push(rows[i])
        }
      }
    } else if (this.op === 'delete') {
      result = rows.filter(matches)
      this.db.tables[this.table] = rows.filter((r) => !matches(r))
    }

    const data = this.op === 'select' || this.returning ? result : null
    if (this.mode === 'single') {
      return result.length === 1
        ? { data: result[0], error: null }
        : { data: null, error: { code: 'PGRST116', message: 'not single' } }
    }
    if (this.mode === 'maybeSingle') return { data: result[0] ?? null, error: null }
    return { data, error: null, count: result.length }
  }
}

/** Cliente con la forma de `SupabaseClient` que usan las rutas. */
export function fakeClient(db: FakeDb, client: 'user' | 'admin', user: Row | null = null) {
  return {
    auth: {
      getUser: async () => ({ data: { user }, error: user ? null : { message: 'No session' } }),
    },
    from: (table: string) => new Query(db, table, client),
  }
}
