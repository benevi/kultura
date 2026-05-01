export const AVATAR_COLORS = [
  { name: 'slate',  hex: '#64748b' },
  { name: 'red',    hex: '#ef4444' },
  { name: 'orange', hex: '#f97316' },
  { name: 'amber',  hex: '#f59e0b' },
  { name: 'green',  hex: '#10b981' },
  { name: 'teal',   hex: '#14b8a6' },
  { name: 'blue',   hex: '#3b82f6' },
  { name: 'purple', hex: '#a855f7' },
] as const

export type AvatarColorName = typeof AVATAR_COLORS[number]['name']

export const SUPPORTED_LOCALES = ['es', 'en'] as const
export type SupportedLocale = typeof SUPPORTED_LOCALES[number]

export function isValidAvatarColor(value: string): value is AvatarColorName {
  return AVATAR_COLORS.some(c => c.name === value)
}

export function isValidLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export function getAvatarHex(colorName: AvatarColorName): string {
  return AVATAR_COLORS.find(c => c.name === colorName)?.hex ?? '#64748b'
}
