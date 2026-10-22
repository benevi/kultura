// ============================================================
// KULTURA — /home (Server Component)
// ============================================================

import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
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

export default async function HomePage() {
  const t = await getTranslations('home')
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Auto-create profile if missing
  const { data: profile } = await supabase
    .from('users').select('id, username').eq('id', user.id).maybeSingle()
  if (!profile) {
    const rawUsername = (user.email ?? 'user').split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || 'user'
    const username = rawUsername.slice(0, 15)
    const { error: insertError } = await supabase
      .from('users')
      .insert({ id: user.id, username, avatar_initials: username.slice(0, 2).toUpperCase(), avatar_color: '#6FCF97' })
    if (insertError?.code === '23505') {
      const { error: e2 } = await supabase
        .from('users')
        .insert({ id: user.id, username: `${username}1`, avatar_initials: username.slice(0, 2).toUpperCase(), avatar_color: '#6FCF97' })
      if (e2) { await supabase.auth.signOut(); redirect('/login') }
    } else if (insertError) {
      await supabase.auth.signOut()
      redirect('/login')
    }
  }

  const locale = await getLocale()

  // Fetches paralelos: in_progress hero + recientes + lo necesario para "Para
  // ti" SIN llamar a la IA (D-06): las recomendaciones de hoy si ya existen y
  // cuántos títulos con señal tiene la biblioteca.
  const [inProgressResult, recentResult, todayRecs, signalResult] = await Promise.all([
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
  ])

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
