// ============================================================
// KULTURA — /home (Server Component)
// ============================================================

import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { HeroSection } from '@/components/home/HeroSection'
import { MediaRow } from '@/components/home/MediaRow'
import { AiRecommendations } from '@/components/home/AiRecommendations'
import { PopularInCircle } from '@/components/home/PopularInCircle'
import { GenreNews } from '@/components/home/GenreNews'
import { getLocale, getTranslations } from 'next-intl/server'
import { MIN_LIBRARY_ITEMS, readTodayAiRecommendations } from '@/lib/claude/recommendations'
import { getStarterItems } from '@/lib/recommendations/starter'
import type { Metadata } from 'next'
import type { HeroItem } from '@/components/home/HeroSection'
import { Link } from '@/i18n/navigation'
import { generatedUsername, initialsFor, purgeDate } from '@/app/api/settings/identity'
import { readAccountState } from '@/app/api/settings/account-state'

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Inicio' }
}

/**
 * Lo popular para una cuenta sin señal (E-INICIO-ARRANQUE). Va en su propio
 * componente de servidor dentro de <Suspense>: con la caché de la muestra fría
 * (o una muestra incompleta, que no se guarda) puede tardar varios segundos y
 * Inicio no debe esperarla. Mientras, el esqueleto. No gasta IA.
 */
async function StarterForYou({ locale }: { locale: string }) {
  const starter = await getStarterItems(locale).catch(() => [])
  // Sin muestra, el botón de siempre: la ruta también sabe devolver lo popular.
  return <AiRecommendations starter={starter.length > 0 ? starter : undefined} />
}

/**
 * Respaldo si el disparador `handle_new_user` no hubiera creado la fila de
 * `users` (no debería pasar). El nombre es el mismo tipo de nombre generado
 * (`u_` + 6), NUNCA la parte local del email (R4), y se escribe con el cliente
 * admin porque `users` no tiene política de INSERT. Reintenta si el nombre
 * aleatorio chocase; si la fila apareció entretanto, vale.
 */
async function ensureProfile(userId: string): Promise<boolean> {
  const admin = createAdminClient()
  for (let attempt = 0; attempt < 3; attempt++) {
    const username = generatedUsername()
    const { error } = await admin
      .from('users')
      .insert({ id: userId, username, avatar_initials: initialsFor(username), avatar_color: 'blue' })
    if (!error) return true
    if (error.code !== '23505') return false
    const { data } = await admin.from('users').select('id').eq('id', userId).maybeSingle()
    if (data) return true
  }
  return false
}

export default async function HomePage() {
  const t = await getTranslations('home')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Perfil que falte (respaldo del disparador): nombre generado, no del email.
  const { data: profile } = await supabase
    .from('users').select('id, username').eq('id', user.id).maybeSingle()
  if (!profile && !(await ensureProfile(user.id))) {
    await supabase.auth.signOut()
    redirect('/login')
  }

  const locale = await getLocale()
  const tSettings = await getTranslations('settings')

  // Fetches paralelos: in_progress hero + recientes + lo necesario para "Para
  // ti" SIN llamar a la IA (D-06): las recomendaciones de hoy si ya existen y
  // cuántos títulos con señal tiene la biblioteca.
  const [inProgressResult, recentResult, todayRecs, signalResult, account] = await Promise.all([
    supabase
      .from('user_media')
      .select('media_id, episode_progress, media(id, title, poster, year, type, synopsis)')
      .eq('user_id', user.id)
      .eq('status', 'in_progress')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('user_media')
      .select('media_id, status, media(id, title, poster, type)')
      .eq('user_id', user.id)
      .in('status', ['in_progress', 'pending'])
      .order('updated_at', { ascending: false })
      .limit(9),
    readTodayAiRecommendations(user.id, locale),
    // Mismo criterio que getLibraryContext: completados o puntuados con ≥ 4.
    supabase
      .from('user_media')
      .select('media_id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .or('status.eq.completed,score.gte.4'),
    // ROJO-7: borrado programado → aviso arriba, con la salida a Ajustes.
    readAccountState(supabase, user.id),
  ])
  const deletionRequestedAt = account.state?.deletion_requested_at ?? null

  // Una cuenta sin señal suficiente no tiene nada que pedirle a la IA: se le
  // enseña directamente lo popular (E-INICIO-ARRANQUE) en vez de un botón que
  // solo podría devolver eso. Si el recuento falla, se deja el botón.
  const signalCount = signalResult.error ? null : signalResult.count
  const showStarter = !todayRecs && signalCount !== null && signalCount < MIN_LIBRARY_ITEMS

  const inProgress = inProgressResult.data as HeroItem | null
  const heroMediaId = inProgress?.media_id

  type RecentRow = {
    media_id: string
    status: string
    media: { id: string; title: string; poster: string | null; type: string } | null
  }

  const filteredRecent = ((recentResult.data ?? []) as unknown as RecentRow[])
    .filter((item) => item.media_id !== heroMediaId)
    .slice(0, 8)
    .map((item) => ({
      mediaId: item.media_id,
      title: item.media?.title ?? '',
      poster: item.media?.poster ?? null,
      type: item.media?.type ?? '',
    }))

  return (
    <main className="max-w-4xl mx-auto px-4 md:px-14 py-6 md:py-8 space-y-8 md:space-y-10">
      {deletionRequestedAt && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-20 border-2 border-accent-danger/50 bg-surface-default px-5 py-4"
        >
          <p className="font-body text-sm text-text-primary">
            {tSettings('deletionPending', {
              date: new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'es-ES', {
                day: 'numeric', month: 'long', year: 'numeric',
              }).format(purgeDate(deletionRequestedAt)),
            })}
          </p>
          <Link
            href="/settings"
            className="inline-flex min-h-[44px] items-center font-body text-sm font-bold text-accent-pink underline-offset-4 hover:underline"
          >
            {tSettings('cancelDeletion')}
          </Link>
        </div>
      )}
      <HeroSection item={inProgress} />

      {filteredRecent.length > 0 && (
        <MediaRow
          title={t('continueWatching')}
          items={filteredRecent}
          requirePoster={false}
        />
      )}

      {/* Orden tras retirar el hero vacío: primero lo propio (lo que sigues, lo
          que la IA te elige por match), después lo social y por último las
          novedades generales. Antes, una cuenta sin título en curso abría con
          la tarjeta vacía de "Popular entre tus amigos". */}
      {showStarter ? (
        <Suspense fallback={<AiRecommendations pending />}>
          <StarterForYou locale={locale} />
        </Suspense>
      ) : (
        <AiRecommendations initial={todayRecs} />
      )}
      <PopularInCircle />
      <GenreNews />
    </main>
  )
}
