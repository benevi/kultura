'use client'

import { useState, useEffect } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Avatar } from '@/components/ui/Avatar'
import { KButton } from '@/components/ui/KButton'
import { createClient } from '@/lib/supabase/client'
import { F0 } from '@/lib/design/f0-tokens'

interface Post {
  id: string
  content: string
  created_at: string
  user_id: string
  users: { username: string; avatar_color: string; avatar_initials: string } | null
}

interface Props {
  groupId: string
  currentUserId: string
}

function relativeDate(iso: string, locale: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return rtf.format(-mins, 'minute')
  const hours = Math.floor(mins / 60)
  if (hours < 24) return rtf.format(-hours, 'hour')
  return rtf.format(-Math.floor(hours / 24), 'day')
}

export function GroupFeed({ groupId, currentUserId }: Props) {
  const locale = useLocale()
  const t = useTranslations('groups')
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    supabase
      .from('group_posts')
      .select('id, content, created_at, user_id, users(username, avatar_color, avatar_initials)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { setPosts((data as unknown as Post[]) ?? []); setLoading(false) })

    const channel = supabase
      .channel(`group:${groupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_posts', filter: `group_id=eq.${groupId}` },
        async (payload) => {
          const newPost = payload.new as Omit<Post, 'users'>
          const { data: userData } = await supabase
            .from('users')
            .select('username, avatar_color, avatar_initials')
            .eq('id', newPost.user_id)
            .maybeSingle()
          const full: Post = { ...newPost, users: userData ?? null }
          setPosts(prev => prev.some(p => p.id === full.id) ? prev : [full, ...prev])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [groupId])

  async function handlePost(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || posting) return
    setPosting(true)
    setPostError(null)
    const supabase = createClient()
    const content = text.trim()
    const { error } = await supabase.from('group_posts').insert({ group_id: groupId, user_id: currentUserId, content })
    if (error) {
      setPostError(t('postError'))
    } else {
      setText('')
    }
    setPosting(false)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Post form */}
      <form onSubmit={handlePost} className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={t('postPlaceholder')}
          rows={3}
          maxLength={1000}
          className="w-full rounded-bento border-2 px-3 py-2.5 text-sm placeholder:opacity-60 resize-none focus:outline-none focus:ring-2 focus-visible:ring-[oklch(68%_0.24_350)]"
          style={{ background: F0.surface2, borderColor: F0.stroke, color: F0.text }}
        />
        {postError && (
          <p className="text-xs" style={{ color: F0.orange }}>{postError}</p>
        )}
        <div className="flex justify-end">
          <KButton
            type="submit"
            size="sm"
            variant="primary"
            disabled={!text.trim() || posting}
            className="rounded-full font-extrabold"
            style={{ background: F0.pink, color: F0.onPink }}
          >
            {posting ? '...' : t('publish')}
          </KButton>
        </div>
      </form>

      {loading ? (
        <div className="text-sm text-center py-8" style={{ color: F0.muted }}>...</div>
      ) : posts.length === 0 ? (
        <div
          className="rounded-bento border p-8 text-center text-sm"
          style={{ background: F0.surface, borderColor: F0.stroke, color: F0.textSecondary }}
        >
          {t('beFirst')}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map(post => (
            <div
              key={post.id}
              className="rounded-bento border p-4 flex gap-3"
              style={{ background: F0.surface, borderColor: F0.stroke }}
            >
              {post.users && (
                <Avatar initials={post.users.avatar_initials} color={post.users.avatar_color} size="sm" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-sm font-bold" style={{ color: F0.text }}>{post.users?.username}</span>
                  <span className="text-xs" style={{ color: F0.muted }}>{relativeDate(post.created_at, locale)}</span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: F0.text }}>{post.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
