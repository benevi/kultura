// ============================================================
// KULTURA — "Esto aún no existe en la base" (único helper)
//
// Para el patrón de desplegar el código ANTES que su migración: tabla,
// columna o función que falta, o caché de esquema de PostgREST sin recargar.
// Una vez aplicada la migración en producción, la tolerancia se retira (F0);
// este helper queda para la siguiente.
// ============================================================

/** 42P01 tabla · 42703 columna · 42883 función · PGRST202/204/205 caché de esquema. */
const NOT_MIGRATED = new Set(['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205'])

export function isNotMigrated(error: { code?: string | null } | null | undefined): boolean {
  return !!error && NOT_MIGRATED.has(error.code ?? '')
}
