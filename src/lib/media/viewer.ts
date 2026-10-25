import * as React from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// ============================================================
// KULTURA — Quién mira la página (usuario y perfil de la petición)
//
// Lo piden el envoltorio con sesión (`AppChrome`, en `(app)` y en la ficha) y
// la propia ficha (biblioteca y afinidad). Va aparte del envoltorio para que
// la página no importe la cabecera y la barra (y sus textos) solo por saber
// si hay sesión.
// ============================================================

/** Perfil mínimo que pintan la cabecera y la barra inferior. */
export interface ViewerProfile {
  username: string
  avatar_color: string
  avatar_initials: string
  avatar_icon?: string | null
}

export interface Viewer {
  user: User | null
  /** `null` con sesión = cuenta sin fila en `users` (alta a medias). */
  profile: ViewerProfile | null
}

// `React.cache` (deduplicar dentro de una petición) existe en el React que Next
// usa para el servidor; en los tests (React estable) no, y ahí basta la función.
const dedupe: <T extends (...args: never[]) => unknown>(fn: T) => T =
  (React as unknown as { cache?: <T>(fn: T) => T }).cache ?? ((fn) => fn)

/**
 * Usuario y perfil de la petición, una sola vez por petición aunque lo pidan
 * el layout y la página. Sin cookie de sesión no sale a la red (`getUser`
 * responde "sin sesión" sin llamar a Supabase): a un visitante anónimo de la
 * ficha no le cuesta nada.
 */
export const getViewer = dedupe(async (): Promise<Viewer> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { user: null, profile: null }

  const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle()
  return { user, profile: (profile as ViewerProfile | null) ?? null }
})
