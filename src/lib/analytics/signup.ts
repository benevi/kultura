// ============================================================
// KULTURA — Alta completada (D-12, CRE-1 + CRE-7). SOLO SERVIDOR.
//
// Lo llama el callback de auth la primera vez que entra una cuenta nueva
// (Google, enlace de confirmación o alta inmediata por correo): guarda de
// dónde viene en `user_metadata.attribution`, registra `signup_completed` y,
// si llegó con una invitación firmada, crea la amistad con quien invitó.
// ============================================================

import type { SupabaseClient, User } from '@supabase/supabase-js'
import { isDemoUser } from '@/lib/demo'
import {
  storedAttribution,
  toStoredAttribution,
  type Attribution,
  type AttributionParams,
} from './attribution'
import { track } from './track'
import { acceptInvite, type InviteOutcome } from './invite'

export interface SignupResult {
  attribution: Attribution
  invite: InviteOutcome | null
  tracked: boolean
}

/** Lo que pesa más: la URL (el clic real) o lo que guardó el `signUp`. */
export function resolveSignupAttribution(fromUrl: AttributionParams, metadata: unknown): Attribution {
  if (fromUrl.channel !== 'direct') return toStoredAttribution(fromUrl)
  return storedAttribution(metadata) ?? { channel: 'direct' }
}

type SignupUser = Pick<User, 'id' | 'app_metadata' | 'user_metadata'>

export async function recordSignup(
  supabase: SupabaseClient,
  user: SignupUser,
  fromUrl: AttributionParams,
): Promise<SignupResult | null> {
  if (isDemoUser(user)) return null
  const attribution = resolveSignupAttribution(fromUrl, user.user_metadata?.attribution)

  // Google no pasa por `signUp`: la atribución llega solo por la URL. Se
  // guarda una vez (no se pisa la del alta por correo ni la de un cambio
  // posterior).
  if (!user.user_metadata?.attribution) {
    await supabase.auth.updateUser({ data: { attribution } }).catch(() => undefined)
  }

  const provider = typeof user.app_metadata?.provider === 'string' ? user.app_metadata.provider : 'email'
  const ref = attribution.ref
  const inv = fromUrl.ref && fromUrl.ref === ref ? fromUrl.inv : undefined

  const [tracked, invite] = await Promise.all([
    track(
      user,
      'signup_completed',
      { ...attribution, provider },
      { dedupeKey: `signup_completed:${user.id}` },
    ),
    ref && inv ? acceptInvite(user, ref, inv) : Promise.resolve(null),
  ])
  return { attribution, invite, tracked }
}
