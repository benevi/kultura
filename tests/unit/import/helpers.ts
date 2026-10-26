// ============================================================
// KULTURA — Utilidades de los tests del importador (F-26)
// ============================================================

import { crc32, deflateRawSync, gzipSync } from 'node:zlib'

/** ZIP mínimo (deflate o stored) para probar el lector sin dependencias. */
export function makeZip(entries: Array<{ name: string; content: string | Uint8Array; store?: boolean }>): Uint8Array {
  const enc = new TextEncoder()
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const e of entries) {
    const raw = Buffer.from(typeof e.content === 'string' ? enc.encode(e.content) : e.content)
    const data = e.store ? raw : deflateRawSync(raw)
    const name = Buffer.from(enc.encode(e.name))
    const crc = crc32(raw) >>> 0
    const method = e.store ? 0 : 8
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x800, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(name.length, 26)
    locals.push(local, name, data)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x800, 8)
    central.writeUInt16LE(method, 10)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(raw.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(offset, 42)
    centrals.push(central, name)
    offset += local.length + name.length + data.length
  }
  const cd = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(cd.length, 12)
  end.writeUInt32LE(offset, 16)
  return new Uint8Array(Buffer.concat([...locals, cd, end]))
}

export function gz(text: string): Uint8Array {
  return new Uint8Array(gzipSync(Buffer.from(text, 'utf8')))
}

export function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

// ── Supabase en memoria ───────────────────────────────────────────────────────

type Row = Record<string, unknown>

export interface FakeDb {
  tables: Record<string, Row[]>
  /** Errores forzados por tabla y operación (`user_media.select`). */
  errors: Record<string, { code: string; message: string } | undefined>
  calls: string[]
}

export function createFakeDb(initial: Record<string, Row[]> = {}): FakeDb {
  return { tables: { media: [], user_media: [], user_media_logs: [], ...initial }, errors: {}, calls: [] }
}

/**
 * Cliente con lo que usa el importador: select(cols).eq().in()/like()/order()/
 * range(), upsert(rows, { onConflict, ignoreDuplicates }) e insert(rows).
 */
export function fakeClient(db: FakeDb) {
  return {
    from(table: string) {
      const rows = () => (db.tables[table] ??= [])
      const filters: Array<(r: Row) => boolean> = []
      let columns: string[] | null = null
      const run = (op: string) => {
        db.calls.push(`${table}.${op}`)
        const forced = db.errors[`${table}.${op}`]
        if (forced) return { data: null, error: forced }
        if (columns && table === 'user_media' && columns.includes('rating10') && db.errors['user_media.noRating10']) {
          return { data: null, error: db.errors['user_media.noRating10'] }
        }
        const data = rows()
          .filter((r) => filters.every((f) => f(r)))
          .map((r) => (columns ? Object.fromEntries(columns.map((c) => [c, r[c] ?? null])) : { ...r }))
        return { data, error: null }
      }
      // `metadata->>malId` (JSON a texto, como PostgREST).
      const read = (r: Row, col: string): unknown => {
        const [base, key] = col.split('->>')
        if (key === undefined) return r[base]
        const v = (r[base] as Record<string, unknown> | null | undefined)?.[key]
        return v === undefined || v === null ? null : String(v)
      }
      const query = {
        eq(col: string, value: unknown) {
          filters.push((r) => read(r, col) === value)
          return query
        },
        in(col: string, values: unknown[]) {
          filters.push((r) => values.includes(read(r, col)))
          return query
        },
        like(col: string, pattern: string) {
          const re = new RegExp('^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$')
          filters.push((r) => re.test(String(r[col])))
          return query
        },
        order() {
          return query
        },
        range() {
          return query
        },
        then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
          return Promise.resolve(run('select')).then(resolve, reject)
        },
      }
      return {
        select(cols: string) {
          columns = cols.split(',').map((c) => c.trim())
          return query
        },
        async upsert(payload: Row | Row[], opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
          db.calls.push(`${table}.upsert`)
          const forced = db.errors[`${table}.upsert`]
          if (forced) return { error: forced }
          const keys = (opts.onConflict ?? 'id').split(',')
          for (const row of Array.isArray(payload) ? payload : [payload]) {
            const existing = rows().find((r) => keys.every((k) => r[k] === row[k]))
            if (existing) {
              if (!opts.ignoreDuplicates) Object.assign(existing, row)
            } else rows().push({ ...row })
          }
          return { error: null }
        },
        async insert(payload: Row | Row[]) {
          db.calls.push(`${table}.insert`)
          const forced = db.errors[`${table}.insert`]
          if (forced) return { error: forced }
          for (const row of Array.isArray(payload) ? payload : [payload]) rows().push({ ...row })
          return { error: null }
        },
      }
    },
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** PRNG determinista (mulberry32) para fixtures y latencias reproducibles. */
export function prng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
