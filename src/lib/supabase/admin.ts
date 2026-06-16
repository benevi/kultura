import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { env, publicEnv } from '@/lib/env'

/**
 * Cliente Supabase con service-role key. BYPASSA RLS — solo para uso server-side
 * en Route Handlers / Server Actions (p.ej. insertar notificaciones para OTRO
 * usuario, imposible con la anon key porque notifications no tiene policy INSERT).
 *
 * NUNCA importar desde un Client Component. La key NO lleva prefijo NEXT_PUBLIC_,
 * así que Next.js no la expone al bundle de cliente: si alguien la importa en
 * cliente, process.env.SUPABASE_SERVICE_ROLE_KEY es undefined y el throw de
 * abajo salta (no hay forma de filtrar la key al browser).
 */
export function createAdminClient() {
  // env/publicEnv ya validados (Zod): la service-role key existe o el server
  // no habría arrancado (instrumentation.ts). Acceso a `env` es lazy + memoizado.
  return createSupabaseClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  )
}
