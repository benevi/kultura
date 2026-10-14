// ============================================================
// KULTURA — Piezas de la colección pública (/u/{username})
// Server Components. Solo primitivos de DISENO.md: avatar, chip inactivo,
// MediaRow con radio 18 (el del perfil) y la tarjeta con sombra dura del login
// para la llamada a registrarse.
// ============================================================

import { getTranslations } from 'next-intl/server'
import { Avatar } from '@/components/ui/Avatar'
import { KButton } from '@/components/ui/KButton'
import { MediaRow } from '@/components/home/MediaRow'
import { Link } from '@/i18n/navigation'
import type { PublicList, PublicOwner } from '@/lib/social/public-collection'

export async function CollectionOwner({ owner }: { owner: PublicOwner }) {
  const t = await getTranslations('collection')
  return (
    <header className="flex items-center gap-5">
      <Avatar
        initials={owner.avatarInitials}
        color={owner.avatarColor}
        icon={owner.avatarIcon}
        size="lg"
      />
      <div className="min-w-0">
        <h1 className="font-display text-[30px] md:text-[42px] font-bold tracking-tight text-text-primary leading-tight">
          {t('heading', { username: owner.username })}
        </h1>
        {owner.bio && (
          <p className="text-[14px] text-text-secondary mt-1 max-w-prose">{owner.bio}</p>
        )}
      </div>
    </header>
  )
}

/** Etiqueta de formato: chip inactivo de F0, no interactivo. */
export function FormatLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-4 py-1.5 rounded-pill bg-surface-elevated text-text-primary text-[13px] font-bold">
      {children}
    </span>
  )
}

export async function PublicListRow({
  list,
  username,
}: {
  list: PublicList
  username: string
}) {
  const t = await getTranslations('collection')
  return (
    <div className="flex flex-col gap-2">
      <MediaRow title={list.name} items={list.items} requirePoster={false} cardRadius="18" />
      <Link
        href={`/u/${username}/l/${list.id}`}
        className="self-start text-[13px] font-bold text-text-secondary hover:text-text-primary"
      >
        {t('viewList')} · {t('items', { count: list.items.length })}
      </Link>
    </div>
  )
}

export async function SignUpCta() {
  const t = await getTranslations('collection')
  return (
    <section className="rounded-bento-xl bg-surface-default p-7 md:p-11 shadow-[10px_10px_0_var(--surface-elevated)] flex flex-col md:flex-row md:items-center gap-5 justify-between">
      <div>
        <h2 className="font-display text-2xl md:text-3xl font-extrabold text-text-primary">
          {t('ctaTitle')}
        </h2>
        <p className="text-[14px] text-text-secondary mt-2 max-w-prose">{t('ctaText')}</p>
      </div>
      <KButton asChild size="lg" className="flex-shrink-0">
        <Link href="/login?mode=register">{t('ctaButton')}</Link>
      </KButton>
    </section>
  )
}
