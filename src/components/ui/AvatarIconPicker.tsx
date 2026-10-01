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

interface AvatarIconPickerProps {
  /** Clave seleccionada, o `null` para "sin personaje" (iniciales). */
  value: string | null
  onChange: (icon: string | null) => void
  /** Etiqueta accesible del grupo de opciones. */
  label: string
  /** Texto de la opción "sin personaje". */
  noneLabel: string
  disabled?: boolean
}

export function AvatarIconPicker({
  value,
  onChange,
  label,
  noneLabel,
  disabled = false,
}: AvatarIconPickerProps) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2.5">
      {/* "Sin personaje" es una opción explícita, no la ausencia de elección:
          quien ya tiene iniciales debe poder volver a ellas. */}
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        aria-label={noneLabel}
        title={noneLabel}
        disabled={disabled}
        onClick={() => onChange(null)}
        className={cn(
          'w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold text-text-secondary',
          'bg-surface-elevated transition-transform hover:scale-105 disabled:opacity-50',
          value === null ? 'ring-2 ring-accent-positive ring-offset-2 ring-offset-surface-default' : ''
        )}
      >
        Aa
      </button>

      {AVATAR_ICON_KEYS.map((key) => {
        const Icon = AVATAR_ICONS[key]
        const selected = value === key
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={key}
            title={key}
            disabled={disabled}
            onClick={() => onChange(key)}
            className={cn(
              'rounded-full transition-transform hover:scale-105 disabled:opacity-50',
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
