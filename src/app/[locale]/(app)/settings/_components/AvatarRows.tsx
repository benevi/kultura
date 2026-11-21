import { useTranslations } from 'next-intl'
import { AVATAR_COLORS } from '@/lib/constants/avatarColors'
import { AvatarIconPicker } from '@/components/ui/AvatarIconPicker'
import { useRadioGroupKeys } from '@/components/ui/useRadioGroupKeys'
import { cn } from '@/lib/utils/index'
import { row, type AccountSettings } from './shared'

/**
 * Perfil › color de avatar — ACC-2/ACC-10: grupo con nombre (antes un
 * <label> huérfano), radios con flechas y nombres traducidos (antes
 * "slate", "amber"…).
 */
export function AvatarColorRow({ avatarColor, setAvatarColor }: Pick<AccountSettings, 'avatarColor' | 'setAvatarColor'>) {
  const t = useTranslations('settings')

  // ACC-10: color de avatar como radiogroup (una parada de Tab, flechas).
  const { getItemProps: getColorProps } = useRadioGroupKeys(
    AVATAR_COLORS.map((c) => c.name),
    avatarColor,
    setAvatarColor
  )

  return (
    <div className={cn(row, 'flex flex-col gap-3')}>
      <span id="avatar-color-label" className="text-sm font-body text-text-secondary">{t('avatarColor')}</span>
      <div role="radiogroup" aria-labelledby="avatar-color-label" className="grid grid-cols-8 gap-1">
        {AVATAR_COLORS.map((color, index) => (
          <button
            key={color.name}
            type="button"
            {...getColorProps(color.name, index)}
            aria-label={t(`avatarColors.${color.name}`)}
            title={t(`avatarColors.${color.name}`)}
            onClick={() => setAvatarColor(color.name)}
            className="group flex h-11 w-11 items-center justify-center rounded-full focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring"
          >
            <span
              aria-hidden="true"
              className={cn(
                'h-8 w-8 rounded-full transition-transform group-hover:scale-110',
                avatarColor === color.name
                  ? 'scale-110 ring-2 ring-accent-positive ring-offset-2 ring-offset-surface-default'
                  : ''
              )}
              style={{ backgroundColor: color.value }}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Perfil › personaje del avatar (E-AVATAR-ICONS) — el propio selector es el
 * radiogroup con nombre; aquí solo el rótulo visible.
 */
export function AvatarIconRow({ avatarIcon, setAvatarIcon }: Pick<AccountSettings, 'avatarIcon' | 'setAvatarIcon'>) {
  const t = useTranslations('settings')

  return (
    <div className={cn(row, 'flex flex-col gap-3')}>
      <span aria-hidden="true" className="text-sm font-body text-text-secondary">{t('avatarIcon')}</span>
      <AvatarIconPicker
        value={avatarIcon}
        onChange={setAvatarIcon}
        label={t('avatarIcon')}
        noneLabel={t('avatarIconNone')}
        iconLabel={(key) => t(`avatarIcons.${key}`)}
      />
    </div>
  )
}
