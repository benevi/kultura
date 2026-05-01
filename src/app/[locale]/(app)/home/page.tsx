// ============================================================
// KULTURA — /home (Server Component)
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { HeroSection } from '@/components/home/HeroSection'
import { MediaRow } from '@/components/home/MediaRow'
import { AiRecommendations } from '@/components/home/AiRecommendations'
import { PopularInCircle } from '@/components/home/PopularInCircle'
import { GenreNews } from '@/components/home/GenreNews'
import type { Metadata } from 'next'
import type { HeroItem } from '@/components/home/HeroSection'

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Inicio · KULTURA' }
}

export default async function HomePage() {
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
      .insert({ id: user.id, username, avatar_initials: username.slice(0, 2).toUpperCase(), avatar_color: '#E82020' })
    if (insertError?.code === '23505') {
      const { error: e2 } = await supabase
        .from('users')
        .insert({ id: user.id, username: `${username}1`, avatar_initials: username.slice(0, 2).toUpperCase(), avatar_color: '#E82020' })
      if (e2) { await supabase.auth.signOut(); redirect('/login') }
    } else if (insertError) {
      await supabase.auth.signOut()
      redirect('/login')
    }
  }

  // Fetches paralelos: in_progress hero + recientes
  const [inProgressResult, recentResult] = await Promise.all([
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
  ])

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
    <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">
      <HeroSection item={inProgress} />

      {filteredRecent.length > 0 && (
        <MediaRow
          title="Continúa donde lo dejaste"
          items={filteredRecent}
        />
      )}

      <PopularInCircle />
      <AiRecommendations />
      <GenreNews />
    </main>
  )
}
