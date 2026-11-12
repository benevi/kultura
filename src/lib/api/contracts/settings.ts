// ============================================================
// KULTURA — Contrato de /api/settings (saneamiento 6.1 y 7.2)
//
// /api/settings   PATCH: actualiza los campos enviados del perfil y, en el
//                 onboarding (F-12), `accept_terms` y `onboarding_done`.
//                 `data: null`; conflictos con `SETTINGS_ERRORS`.
// /api/settings/platforms   PUT: «Mis plataformas» (F-25), lista completa y
//                 región. `data: null`. Saneamiento 9.2.
// ============================================================

import { z } from 'zod'
import { isValidAvatarColor, isValidLocale } from '@/lib/constants/avatarColors'
import { isValidAvatarIcon } from '@/components/icons/avatars'
import { LIBRARY_VISIBILITIES, USERNAME_REGEX } from '@/lib/account/identity'
import { BIO_MAX_LENGTH, SETTINGS_ERRORS } from '@/lib/settings/errors'
import { MAX_PLATFORMS, PLATFORM_REGIONS } from '@/lib/platforms/platforms'

export { BIO_MAX_LENGTH, SETTINGS_ERRORS }

/** PATCH /api/settings. */
export const settingsPatchSchema = z.object({
  username: z.string().regex(USERNAME_REGEX).optional(),
  avatar_color: z.string().refine(isValidAvatarColor, { message: 'invalid_avatar_color' }).optional(),
  preferred_locale: z.string().refine(isValidLocale, { message: 'invalid_locale' }).optional(),
  // E-AVATAR-ICONS: `null` es un valor VÁLIDO, no "no enviado": así se vuelve
  // a las iniciales tras haber elegido personaje.
  avatar_icon: z.string().refine(isValidAvatarIcon, { message: 'invalid_avatar_icon' }).nullable().optional(),
  // Vacía o solo espacios = sin bio (`null`).
  bio: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().max(BIO_MAX_LENGTH))
    .nullable()
    .optional(),
  library_visibility: z.enum(LIBRARY_VISIBILITIES).optional(),
  /** Paso 1 de /welcome (alta con Google): "tengo 14 años o más y acepto". */
  accept_terms: z.literal(true).optional(),
  /** Fin (o salto) del onboarding. */
  onboarding_done: z.literal(true).optional(),
})

export type SettingsPatch = z.input<typeof settingsPatchSchema>

/** `data` de PATCH /api/settings. */
export const settingsPatchResultSchema = z.null()

/** PUT /api/settings/platforms: ids de TMDB (sin repetidos) y región. */
export const platformsPutSchema = z.object({
  services: z
    .array(z.number().int().positive())
    .max(MAX_PLATFORMS)
    .transform((ids) => [...new Set(ids)]),
  region: z.enum(PLATFORM_REGIONS),
})

export type PlatformsPut = z.input<typeof platformsPutSchema>

/** `data` de PUT /api/settings/platforms. */
export const platformsPutResultSchema = z.null()
