'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { createClient } from '@/lib/supabase/client'

interface AvatarDropdownProps {
  username: string
  avatarColor: string
  avatarInitials: string
}

export function AvatarDropdown({ username, avatarColor, avatarInitials }: AvatarDropdownProps) {
  const t = useTranslations('nav')
  const tAuth = useTranslations('auth')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div ref={ref} className="relative ml-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="rounded-full focus:outline-none focus:ring-2 focus:ring-accent"
        aria-label={username}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Avatar initials={avatarInitials} color={avatarColor} size="sm" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-48 bg-surface border border-border rounded-xl shadow-xl py-1 z-50"
        >
          <Link
            href={`/profile/${username}`}
            role="menuitem"
            className="flex items-center gap-2 px-4 py-2 text-sm text-text hover:bg-surface2 transition-colors"
            onClick={() => setOpen(false)}
          >
            {t('profile')}
          </Link>
          <Link
            href="/settings"
            role="menuitem"
            className="flex items-center gap-2 px-4 py-2 text-sm text-text hover:bg-surface2 transition-colors"
            onClick={() => setOpen(false)}
          >
            {t('settings')}
          </Link>
          <div className="my-1 border-t border-border" />
          <button
            role="menuitem"
            className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-danger hover:bg-surface2 transition-colors"
            onClick={handleSignOut}
          >
            {tAuth('signOut')}
          </button>
        </div>
      )}
    </div>
  )
}
