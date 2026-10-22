import { Link } from '@/i18n/navigation'
import { NavLinks } from '@/components/layout/NavLinks'
import { AvatarDropdown } from '@/components/layout/AvatarDropdown'
import { SocialMenu } from '@/components/layout/SocialMenu'
import { NotificationsBell } from '@/components/layout/NotificationsBell'
import { FOCUS_RING } from '@/components/layout/nav-shared'
import { Logo } from '@/components/layout/Logo'

interface UserProfile {
  username: string
  avatar_color: string
  avatar_initials: string
  avatar_icon?: string | null
}

interface AuthHeaderProps {
  profile: UserProfile
  unreadCount: number
}

/**
 * Cabecera con sesión (DISENO.md): 56 px, opaca. Logo a la izquierda, los 5
 * destinos en el centro (solo escritorio; en móvil van en `BottomNav`) y a la
 * derecha tres cajas de 44×44: Social, notificaciones y avatar. A 320 px
 * caben logo + 3 cajas sin scroll horizontal (el idioma va en el menú del
 * avatar).
 */
export function AuthHeader({ profile, unreadCount }: AuthHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-surface-default border-b border-surface-border">
      <div className="relative flex items-center gap-2 h-14 max-w-6xl mx-auto px-4 md:px-8">
        <Link
          href="/home"
          className={`flex items-center min-h-11 flex-shrink-0 rounded-[14px] hover:opacity-80 transition-opacity ${FOCUS_RING}`}
        >
          <Logo size={24} />
        </Link>

        <NavLinks username={profile.username} />

        <div className="flex items-center gap-2 ml-auto">
          <SocialMenu />

          <NotificationsBell unreadCount={unreadCount} />

          <AvatarDropdown
            username={profile.username}
            avatarColor={profile.avatar_color}
            avatarInitials={profile.avatar_initials}
            avatarIcon={profile.avatar_icon ?? null}
          />
        </div>
      </div>
    </header>
  )
}
