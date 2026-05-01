import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { NavLinks } from '@/components/layout/NavLinks'
import { AvatarDropdown } from '@/components/layout/AvatarDropdown'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'

interface UserProfile {
  username: string
  avatar_color: string
  avatar_initials: string
}

interface AuthHeaderProps {
  profile: UserProfile
  unreadCount: number
}

export async function AuthHeader({ profile, unreadCount }: AuthHeaderProps) {
  const t = await getTranslations('nav')

  return (
    <header className="sticky top-0 z-40 bg-bg/95 backdrop-blur-sm border-b border-border">
      <div className="flex items-center h-14 max-w-6xl mx-auto px-4 md:px-8">
        {/* Logo */}
        <Link href="/home" className="flex-shrink-0">
          <span className="font-display text-xl font-bold tracking-widest text-accent hover:text-accent/80 transition-colors">
            KULTURA
          </span>
        </Link>

        {/* Desktop nav (centered) */}
        <NavLinks />

        {/* Right icons */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Search — desktop only */}
          <Link
            href="/search"
            aria-label={t('search')}
            className="hidden md:flex items-center justify-center w-8 h-8 text-muted hover:text-text hover:bg-surface2 rounded-md transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </Link>

          {/* Notifications bell — visible on all viewports */}
          <Link
            href="/notifications"
            aria-label={t('notifications')}
            className="relative flex items-center justify-center w-8 h-8 text-muted hover:text-text hover:bg-surface2 rounded-md transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>

          {/* Language switcher */}
          <LanguageSwitcher />

          {/* Avatar dropdown */}
          <AvatarDropdown
            username={profile.username}
            avatarColor={profile.avatar_color}
            avatarInitials={profile.avatar_initials}
          />
        </div>
      </div>
    </header>
  )
}
