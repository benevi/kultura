// ============================================================
// KULTURA — Reglas de identidad compartidas (F-12)
//
// Sin dependencias de servidor: lo importan la API de ajustes, el registro y
// el onboarding (`/welcome`). La base aplica las mismas reglas con CHECK
// (migración 20261101120001_identity_privacy.sql); un test comprueba que la
// lista de reservados es la misma en los dos sitios.
// ============================================================

/** Versión de los términos que se aceptan al registrarse (`legal.terms.version`). */
export const TERMS_VERSION = '2026-10'

/** Formato de nombre de usuario: el de la API y el CHECK `users_username_format`. */
export const USERNAME_REGEX = /^[A-Za-z0-9_]{3,20}$/

/** Nombre que pone la base al registrarse (`handle_new_user`): `u_` + 6 [a-z0-9]. */
export const GENERATED_USERNAME_REGEX = /^u_[a-z0-9]{6}$/

/**
 * Nombres que nadie puede elegir: suplantan al servicio o chocan con rutas.
 * Misma lista que el CHECK `users_username_not_reserved`.
 */
export const RESERVED_USERNAMES = [
  'admin', 'administrator', 'administrador', 'root', 'kultura', 'kulturaapp', 'support', 'soporte',
  'help', 'ayuda', 'moderator', 'moderador', 'mod', 'staff', 'team', 'equipo', 'official', 'oficial',
  'api', 'login', 'logout', 'settings', 'ajustes', 'welcome', 'home', 'system', 'sistema', 'null',
  'undefined', 'anonymous', 'anonimo', 'me', 'demo', 'security', 'seguridad', 'privacy', 'terms',
  'legal', 'report', 'u', 'profile', 'www',
] as const

/**
 * ¿Está reservado? Además de la lista, nada que empiece por "kultura" (solo
 * en la API: la cuenta demo `kultura_demo` la crea el script con el admin).
 */
export function isReservedUsername(name: string): boolean {
  const lower = name.toLowerCase()
  return (RESERVED_USERNAMES as readonly string[]).includes(lower) || lower.startsWith('kultura')
}

/** Quién ve la biblioteca (D-04b). El anónimo, nunca. */
export const LIBRARY_VISIBILITIES = ['public', 'friends', 'private'] as const
export type LibraryVisibility = (typeof LIBRARY_VISIBILITIES)[number]
export const DEFAULT_LIBRARY_VISIBILITY: LibraryVisibility = 'friends'

export function isLibraryVisibility(value: unknown): value is LibraryVisibility {
  return typeof value === 'string' && (LIBRARY_VISIBILITIES as readonly string[]).includes(value)
}

/** Días entre pedir el borrado y borrar de verdad (ROJO-7). */
export const ACCOUNT_GRACE_DAYS = 7

/**
 * Nombre generado como el de `handle_new_user` (`u_` + 6 [a-z0-9]), para el
 * respaldo de Inicio si la fila de `users` no existiera. Nada del email.
 */
export function generatedUsername(random: (n: number) => Uint8Array = randomBytes): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return 'u_' + Array.from(random(6), (b) => alphabet[b % alphabet.length]).join('')
}

function randomBytes(n: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(n))
}

/** Iniciales del avatar a partir del nombre (sin el prefijo `u_` del generado). */
export function initialsFor(username: string): string {
  return username.replace(/^u_/, '').slice(0, 2).toUpperCase() || 'K'
}

/** Fecha en la que se borra una cuenta cuyo borrado se pidió en `requestedAt`. */
export function purgeDate(requestedAt: string | Date): Date {
  const start = typeof requestedAt === 'string' ? new Date(requestedAt) : requestedAt
  return new Date(start.getTime() + ACCOUNT_GRACE_DAYS * 24 * 60 * 60 * 1000)
}
