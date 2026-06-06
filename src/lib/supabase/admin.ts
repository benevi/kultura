import { createClient as createSupabaseClient } from '@supabase/supabase-js'

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL no está definida')
  }
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY no está definida (requerida para el admin client)')
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
