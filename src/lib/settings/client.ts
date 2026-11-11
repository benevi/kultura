// ============================================================
// KULTURA — Cliente de /api/settings (saneamiento 6 y 7)
// Lanza `ApiError`: `invalid_input` (campo en `field`) o `conflict` con un
// mensaje de `SETTINGS_ERRORS` (nombre cogido o reservado, faltan términos).
// ============================================================

import { apiFetch } from '@/lib/api/client'
import type { SettingsPatch } from '@/lib/api/contracts/settings'

export type { SettingsPatch }

export async function updateSettings(patch: SettingsPatch): Promise<void> {
  await apiFetch('/api/settings', { method: 'PATCH', json: patch })
}
