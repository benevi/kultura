// ============================================================
// KULTURA — Mensajes estables de /api/settings (saneamiento 7)
// Van en `error.message` con `code: 'conflict'`. Sin dependencias.
// ============================================================

export const SETTINGS_ERRORS = {
  /** Lo tiene otra persona (o lo tuvo: los nombres antiguos quedan reservados). */
  usernameTaken: 'username_taken',
  /** Nombre reservado (rutas, marcas…). */
  usernameReserved: 'username_reserved',
  /** SEG-7: no se termina el onboarding sin aceptar los términos. */
  termsRequired: 'terms_required',
} as const

/** Tope de la bio: el `maxLength` del editor (`ProfileBio`) y el de la API. */
export const BIO_MAX_LENGTH = 200
