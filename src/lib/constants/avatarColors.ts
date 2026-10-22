/**
 * Paleta de colores de avatar (iniciales).
 *
 * ACC-9: era hex de Tailwind con iniciales en blanco y solo 1 de 8 colores
 * llegaba a 4,5:1 (ámbar 2,15:1). Ahora es OKLCH como el resto del sistema
 * (DISENO.md prohíbe mezclar hex) y cada color trae su texto "on-color"
 * oscuro del mismo matiz, el patrón de F0 para texto sobre acentos vivos.
 * Contrastes (tests/unit/design/contrast.test.ts): 4,99-9,86:1.
 *
 * `blue`, `orange` y `purple` coinciden con los acentos del sistema; el resto
 * son los mismos tonos de antes llevados a la luminosidad de los acentos F0.
 */
export const AVATAR_COLORS = [
  { name: 'slate', value: 'oklch(72% 0.03 260)', on: 'oklch(16% 0.02 260)' },
  { name: 'red', value: 'oklch(70% 0.17 25)', on: 'oklch(16% 0.03 25)' },
  { name: 'orange', value: 'oklch(72% 0.19 55)', on: 'oklch(16% 0.03 55)' },
  { name: 'amber', value: 'oklch(80% 0.16 75)', on: 'oklch(18% 0.03 75)' },
  { name: 'green', value: 'oklch(76% 0.17 150)', on: 'oklch(18% 0.03 150)' },
  { name: 'teal', value: 'oklch(76% 0.12 190)', on: 'oklch(18% 0.03 190)' },
  { name: 'blue', value: 'oklch(68% 0.16 250)', on: 'oklch(14% 0.03 250)' },
  { name: 'purple', value: 'oklch(62% 0.19 300)', on: 'oklch(15% 0.02 300)' },
].map((c) => ({
  ...c,
  /**
   * @deprecated Usar `value`. Se conserva para quien aún lea `.hex` (la
   * muestra de color de Ajustes): ahora contiene el mismo color OKLCH, que es
   * un valor CSS válido en cualquier `style`.
   */
  hex: c.value,
})) as ReadonlyArray<{
  readonly name: AvatarColorName
  readonly value: string
  readonly on: string
  readonly hex: string
}>

export type AvatarColorName =
  | 'slate'
  | 'red'
  | 'orange'
  | 'amber'
  | 'green'
  | 'teal'
  | 'blue'
  | 'purple'

export const SUPPORTED_LOCALES = ['es', 'en'] as const
export type SupportedLocale = typeof SUPPORTED_LOCALES[number]

export function isValidAvatarColor(value: string): value is AvatarColorName {
  return AVATAR_COLORS.some(c => c.name === value)
}

export function isValidLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/**
 * Color de fondo de un nombre de la paleta.
 * @deprecated El nombre es histórico: devuelve el valor OKLCH. Usar
 * `getAvatarColor`.
 */
export function getAvatarHex(colorName: AvatarColorName): string {
  return getAvatarColor(colorName)?.value ?? AVATAR_COLORS[0].value
}

/** Entrada de la paleta para un nombre (`'blue'`…), o `undefined` si no es de la paleta. */
export function getAvatarColor(colorName: string): (typeof AVATAR_COLORS)[number] | undefined {
  return AVATAR_COLORS.find(c => c.name === colorName)
}
