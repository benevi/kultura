'use client'

import { useState, useEffect } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Avatar } from '@/components/ui/Avatar'
import { createClient } from '@/lib/supabase/client'

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
          className="w-full bg-surface2 border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder-muted resize-none focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {postError && (
          <p className="text-xs text-red-500">{postError}</p>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!text.trim() || posting}
            className="px-4 py-2 text-sm font-semibold bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {posting ? '...' : t('publish')}
          </button>
        </div>
      </form>

      {loading ? (
        <div className="text-sm text-muted text-center py-8">...</div>
      ) : posts.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center text-sm text-muted">
          {t('beFirst')}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map(post => (
            <div key={post.id} className="bg-surface border border-border rounded-xl p-4 flex gap-3">
              {post.users && (
                <Avatar initials={post.users.avatar_initials} color={post.users.avatar_color} size="sm" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-sm font-semibold text-text">{post.users?.username}</span>
                  <span className="text-xs text-muted">{relativeDate(post.created_at, locale)}</span>
                </div>
                <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">{post.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
