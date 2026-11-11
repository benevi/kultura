// ============================================================
// KULTURA — Route Handler: /api/chat/unread (E96)
// GET: cuántas conversaciones tienen algo sin leer (el globo del menú).
// Antes era GET /api/chat?countOnly=1.
// ============================================================

import { requireUser, respond } from '@/lib/api/route'
import { countUnread } from '@/lib/chat/service'

/** GET /api/chat/unread */
export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  return respond(await countUnread(auth.supabase, auth.user.id))
}
