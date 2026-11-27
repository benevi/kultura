// ============================================================
// KULTURA — ¿Hay un bloqueo entre quien mira y otra persona? SOLO SERVIDOR.
//
// Lo usan las páginas públicas que enseñan datos de alguien (`/u/…`,
// `/u/…/l/…`, `/u/…/r/…`): con sesión, si hay un bloqueo en CUALQUIER
// sentido, no se enseña nada de esa persona (salvo lo que ya es catálogo).
// Pregunta a la base con la sesión de quien mira (`has_block_with`, que solo
// dice si hay bloqueo, no quién bloqueó). Ante un error: sí (no se enseña).
// Sin sesión, o si quien mira es el dueño, no hay bloqueo posible.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'

/** ¿Hay un bloqueo entre la sesión de `client` y `otherId`? Ante un error: sí. */
export async function hasBlockWith(client: SupabaseClient, otherId: string): Promise<boolean> {
  try {
    const { data, error } = await client.rpc('has_block_with', { p_other: otherId })
    if (error) return true
    return data === true
  } catch {
    return true
  }
}

/**
 * Igual que `hasBlockWith`, pero sin consultar cuando no hace falta: sin
 * sesión (`viewerId` nulo) o si quien mira es el propio dueño, `false`.
 */
export async function viewerBlockedWith(
  client: SupabaseClient,
  viewerId: string | null | undefined,
  ownerId: string,
): Promise<boolean> {
  if (!viewerId || viewerId === ownerId) return false
  return hasBlockWith(client, ownerId)
}
