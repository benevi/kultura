'use client'

// ============================================================
// KULTURA — Selector de personaje (E-AVATAR-ICONS)
//
// Mismo control para el registro, los ajustes de perfil y los grupos: los tres
// eligen sobre el mismo catálogo, así que tener un único componente evita que
// se separen visualmente con el tiempo.
// ============================================================

import { AVATAR_ICONS, AVATAR_ICON_KEYS } from '@/components/icons/avatars'
import { cn } from '@/lib/utils/index'
import { useRadioGroupKeys } from '@/components/ui/useRadioGroupKeys'

/** Valor de la opción "sin personaje" dentro del grupo de radios. */
const NONE = '__none__'

interface AvatarIconPickerProps {
  /** Clave seleccionada, o `null` para "sin personaje" (iniciales). */
  value: string | null
  onChange: (icon: string | null) => void
  /** Etiqueta accesible del grupo de opciones. */
  label: string
  /** Texto de la opción "sin personaje". */
  noneLabel: string
  disabled?: boolean
  /**
   * Nombre accesible traducido de cada personaje (`settings.avatarIcons.*`).
   * Sin él se usa la clave interna ("fox"), que no está traducida.
   */
  iconLabel?: (key: string) => string
}

export function AvatarIconPicker({
  value,
  onChange,
  label,
  noneLabel,
  disabled = false,
  iconLabel = (key) => key,
}: AvatarIconPickerProps) {
  // ACC-10: radiogroup con una sola parada de Tab y flechas.
  const { getItemProps } = useRadioGroupKeys(
    [NONE, ...AVATAR_ICON_KEYS],
    value ?? NONE,
    (v) => onChange(v === NONE ? null : v),
    { disabled }
  )
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2.5">
      {/* "Sin personaje" es una opción explícita, no la ausencia de elección:
          quien ya tiene iniciales debe poder volver a ellas. */}
      <button
        type="button"
        {...getItemProps(NONE, 0)}
        aria-label={noneLabel}
        title={noneLabel}
        disabled={disabled}
        onClick={() => onChange(null)}
        className={cn(
          'w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold text-text-secondary',
          'bg-surface-elevated transition-transform hover:scale-105 disabled:opacity-50',
          'focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-ring',
          value === null ? 'ring-2 ring-accent-positive ring-offset-2 ring-offset-surface-default' : ''
        )}
      >
        Aa
      </button>

      {AVATAR_ICON_KEYS.map((key, i) => {
        const Icon = AVATAR_ICONS[key]
        const selected = value === key
        return (
          <button
            key={key}
            type="button"
            {...getItemProps(key, i + 1)}
            aria-label={iconLabel(key)}
            title={iconLabel(key)}
            disabled={disabled}
            onClick={() => onChange(key)}
            className={cn(
              'rounded-full transition-transform hover:scale-105 disabled:opacity-50',
              'focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-ring',
              selected ? 'ring-2 ring-accent-positive ring-offset-2 ring-offset-surface-default' : ''
            )}
          >
            {/* El personaje trae su propio disco: pintarlo sobre un fondo de
                color lo aplanaba y hacía que los doce parecieran el mismo. */}
            <Icon className="w-11 h-11 rounded-full" aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}
