// ============================================================
// Cliente de Supabase falso para los tests de F-25.
//
// Cada `from(tabla)` devuelve una cadena que acepta cualquier método
// (`select`, `eq`, `insert`, `order`…), lo apunta y se resuelve (await) con
// el siguiente resultado de la cola de esa tabla. Así los tests comprueban
// QUÉ se pidió (`ops`) sin depender del orden exacto de los encadenados.
// ============================================================

export interface FakeResult {
  data?: unknown
  error?: { code?: string; message?: string } | null
  count?: number | null
}

export interface Op {
  name: string
  args: unknown[]
}

export interface Call {
  table: string
  ops: Op[]
}

type Responder = FakeResult | ((call: Call) => FakeResult)

export interface FakeClient {
  from: (table: string) => unknown
  rpc: (fn: string, args: unknown) => Promise<FakeResult>
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null }; error: null }> }
  calls: Call[]
  rpcCalls: Array<{ fn: string; args: unknown }>
}

export function fakeSupabase(opts: {
  user?: { id: string } | null
  tables?: Record<string, Responder[]>
  rpc?: Record<string, Responder>
}): FakeClient {
  const queues: Record<string, Responder[]> = {}
  for (const [k, v] of Object.entries(opts.tables ?? {})) queues[k] = [...v]
  const calls: Call[] = []
  const rpcCalls: Array<{ fn: string; args: unknown }> = []

  function chainFor(table: string) {
    const call: Call = { table, ops: [] }
    calls.push(call)
    const resolve = (): FakeResult => {
      const q = queues[table] ?? []
      const next = q.length > 1 ? q.shift()! : q[0]
      if (!next) return { data: null, error: null }
      return typeof next === 'function' ? next(call) : next
    }
    const proxy: unknown = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'then') {
            return (ok: (v: FakeResult) => unknown, ko?: (e: unknown) => unknown) => {
              try {
                return Promise.resolve(resolve()).then(ok, ko)
              } catch (e) {
                return ko ? ko(e) : Promise.reject(e)
              }
            }
          }
          return (...args: unknown[]) => {
            call.ops.push({ name: String(prop), args })
            return proxy
          }
        },
      },
    )
    return proxy
  }

  return {
    from: (table: string) => chainFor(table),
    rpc: async (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args })
      const r = opts.rpc?.[fn]
      if (!r) return { data: null, error: { code: 'PGRST202', message: 'not found' } }
      return typeof r === 'function' ? r({ table: fn, ops: [] }) : r
    },
    auth: { getUser: async () => ({ data: { user: opts.user ?? null }, error: null }) },
    calls,
    rpcCalls,
  }
}

/** Operaciones de las llamadas a una tabla que incluyen `name`. */
export function opsOf(client: FakeClient, table: string, name: string): Op[] {
  return client.calls.filter((c) => c.table === table).flatMap((c) => c.ops.filter((o) => o.name === name))
}

/** ¿Alguna llamada a `table` encadenó `a` y después `b`? */
export function chained(client: FakeClient, table: string, a: string, b: string): boolean {
  return client.calls
    .filter((c) => c.table === table)
    .some((c) => {
      const i = c.ops.findIndex((o) => o.name === a)
      return i !== -1 && c.ops.slice(i + 1).some((o) => o.name === b)
    })
}
