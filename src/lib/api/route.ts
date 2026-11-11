// ============================================================
// KULTURA — Helpers de los Route Handlers (saneamiento 6.2 y 7.1)
//
// Cada paso devuelve o el valor o la respuesta de error ya hecha, para que el
// handler quede en una lista de guardas:
//
//   const auth = await requireUser()
//   if (!auth.ok) return auth.response
//   const limited = await rateLimit(req, { key: 'library', limit: LIMITS.library, userId: auth.user.id })
//   if (limited) return limited
//   const body = await parseBody(req, schema)
//   if (!body.ok) return body.response
//   …
//   return ok(entry)
// ============================================================

import 'server-only'
import { NextResponse } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimitDistributed, type RateLimitOptions } from '@/lib/rate-limit'
import { clientIp } from '@/lib/api/discover-params'
import { API_ERRORS, type ApiErrorCode, type ApiErrorBody, type ApiSuccessBody } from '@/lib/api/errors'
import type { ServiceResult } from '@/lib/api/result'

export { clientIp }

type Fail = { ok: false; response: NextResponse }

// ── Respuestas ───────────────────────────────────────────────────────────────

/** Éxito: `{ data }`. */
export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccessBody<T>> {
  return NextResponse.json({ data }, init)
}

export interface ApiErrorOptions {
  message?: string
  field?: string
  /** Para los pocos casos en que el estado no es el del catálogo. */
  status?: number
  headers?: HeadersInit
}

/** Error: `{ error: { code, message?, field? } }` con el estado del catálogo. */
export function apiError(code: ApiErrorCode, opts: ApiErrorOptions = {}): NextResponse<ApiErrorBody> {
  const { message, field, status, headers } = opts
  return NextResponse.json(
    {
      error: {
        code,
        ...(message !== undefined ? { message } : {}),
        ...(field !== undefined ? { field } : {}),
      },
    },
    { status: status ?? API_ERRORS[code], headers }
  )
}

/** Respuesta de un servicio: `{ data }` (con `init`, p. ej. 201) o el error con su código. */
export function respond<T>(
  result: ServiceResult<T>,
  init?: ResponseInit
): NextResponse<ApiSuccessBody<T> | ApiErrorBody> {
  if (result.ok) return ok(result.value, init)
  return apiError(result.code, { message: result.message, field: result.field })
}

// ── Sesión ───────────────────────────────────────────────────────────────────

export type Supabase = SupabaseClient

/** Usuario de la sesión y el cliente de Supabase con su cookie, o un 401. */
export async function requireUser(): Promise<{ ok: true; user: User; supabase: Supabase } | Fail> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return { ok: false, response: apiError('unauthenticated') }
  return { ok: true, user: data.user, supabase }
}

// ── Límite de peticiones ─────────────────────────────────────────────────────

export interface RateLimitSpec {
  /** Nombre del cupo (p. ej. `library`). */
  key: string
  limit: RateLimitOptions
  /** Con sesión, el cupo es por usuario; sin ella, por IP. */
  userId?: string
}

/**
 * Límite compartido entre instancias (Redis, con memoria de respaldo).
 * `null` si se puede seguir; si no, el 429 con `Retry-After`.
 */
export async function rateLimit(req: Request, spec: RateLimitSpec): Promise<NextResponse<ApiErrorBody> | null> {
  const who = spec.userId ?? `ip:${clientIp(req.headers)}`
  const rl = await checkRateLimitDistributed(`${spec.key}:${who}`, spec.limit)
  if (rl.allowed) return null
  return apiError('rate_limited', {
    headers: { 'Retry-After': String(rl.retryAfterSeconds), 'Cache-Control': 'no-store' },
  })
}

// ── Entrada ──────────────────────────────────────────────────────────────────

/** Ruta del primer fallo de zod como `a.b.0`, o nada si es la raíz. */
function issueField(error: z.ZodError): string | undefined {
  const path = error.issues[0]?.path ?? []
  return path.length ? path.map(String).join('.') : undefined
}

function invalid(error: z.ZodError): Fail {
  return {
    ok: false,
    response: apiError('invalid_input', { field: issueField(error), message: error.issues[0]?.message }),
  }
}

/** Cuerpo JSON validado con `schema`: 400 `invalid_json` o `invalid_input`. */
export async function parseBody<S extends z.ZodType>(
  req: Request,
  schema: S
): Promise<{ ok: true; value: z.output<S> } | Fail> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return { ok: false, response: apiError('invalid_json') }
  }
  const parsed = schema.safeParse(raw)
  return parsed.success ? { ok: true, value: parsed.data } : invalid(parsed.error)
}

/** Query params validados con `schema` (cada clave, su primer valor). */
export function parseQuery<S extends z.ZodType>(
  req: Request,
  schema: S
): { ok: true; value: z.output<S> } | Fail {
  const params = new URL(req.url).searchParams
  const raw: Record<string, string> = {}
  for (const key of new Set(params.keys())) raw[key] = params.get(key) as string
  const parsed = schema.safeParse(raw)
  return parsed.success ? { ok: true, value: parsed.data } : invalid(parsed.error)
}
