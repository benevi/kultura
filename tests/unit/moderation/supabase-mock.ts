// ============================================================
// KULTURA — Doble mínimo del cliente de Supabase para los tests de F-11.
// Registra cada consulta (tabla, operación, filtros, carga, RETURNING) y
// la resuelve con un `handler` que decide { data, error } como haría la base.
// ============================================================

export type Op = 'select' | 'insert' | 'upsert' | 'delete' | 'update' | 'rpc'

export interface QueryCall {
  table: string
  op: Op
  filters: Record<string, unknown>
  or?: string
  payload?: unknown
  returning: boolean
  args?: unknown
}

export type Handler = (call: QueryCall) => { data?: unknown; error?: { code?: string; message?: string } | null }

export function makeSupabase(opts: { user: { id: string } | null; handler: Handler }) {
  const calls: QueryCall[] = []

  function run(call: QueryCall) {
    calls.push(call)
    const res = opts.handler(call)
    return { data: res.data ?? null, error: res.error ?? null }
  }

  function from(table: string) {
    const call: QueryCall = { table, op: 'select', filters: {}, returning: false }
    const builder: Record<string, unknown> = {
      select: () => {
        if (call.op !== 'select') call.returning = true
        return builder
      },
      insert: (payload: unknown) => { call.op = 'insert'; call.payload = payload; return builder },
      upsert: (payload: unknown) => { call.op = 'upsert'; call.payload = payload; return builder },
      update: (payload: unknown) => { call.op = 'update'; call.payload = payload; return builder },
      delete: () => { call.op = 'delete'; return builder },
      eq: (col: string, value: unknown) => { call.filters[col] = value; return builder },
      neq: (col: string, value: unknown) => { call.filters[`!${col}`] = value; return builder },
      is: (col: string, value: unknown) => { call.filters[col] = value; return builder },
      or: (expr: string) => { call.or = expr; return builder },
      order: () => builder,
      limit: () => builder,
      maybeSingle: async () => run(call),
      single: async () => run(call),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(run(call)).then(resolve, reject),
    }
    return builder
  }

  const client = {
    auth: { getUser: async () => ({ data: { user: opts.user }, error: null }) },
    from,
    rpc: async (name: string, args: unknown) => run({ table: `rpc:${name}`, op: 'rpc', filters: {}, returning: false, args }),
  }

  return { client, calls }
}
