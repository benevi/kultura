import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { NavLinks } from '@/components/layout/NavLinks'
import { AvatarDropdown } from '@/components/layout/AvatarDropdown'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { Logo } from '@/components/layout/Logo'
import { IconBell } from '@/components/icons'

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
    <header className="sticky top-0 z-40 bg-surface-default border-b border-surface-border">
      <div className="flex items-center h-14 max-w-6xl mx-auto px-4 md:px-8">
        {/* Logo */}
        <Link href="/home" className="flex-shrink-0 hover:opacity-80 transition-opacity">
          <Logo size={24} />
        </Link>

        {/* Desktop nav (centered) */}
        <NavLinks />

        {/* Right icons */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* E-DISCOVER-SEARCH-MERGE: el icono de lupa se retiró del header —
              el buscador vive dentro de /discover (entrada "Descubrir" de la
              nav), así que un acceso aparte duplicaba el mismo destino. */}

          {/* Notifications bell — visible on all viewports */}
          <Link
            href="/notifications"
            aria-label={t('notifications')}
            className="relative flex items-center justify-center w-8 h-8 text-muted hover:text-text hover:bg-surface2 rounded-md transition-colors"
          >
            <IconBell className="w-[18px] h-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-accent-positive text-on-accent-positive text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
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
