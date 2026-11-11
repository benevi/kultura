// ============================================================
// KULTURA — Mensajes estables de /api/account (saneamiento 7)
// Van en `error.message` junto al `code` del catálogo. Sin dependencias:
// los usan el servidor, el cliente y los tests.
// ============================================================

export const ACCOUNT_ERRORS = {
  /** Borrar una cuenta con contraseña sin mandarla (`invalid_input`). */
  passwordRequired: 'password_required',
  /** Contraseña incorrecta al borrar (`forbidden`). */
  wrongPassword: 'wrong_password',
  /** Cuenta solo con Google: hay que volver a entrar (`forbidden`). */
  reauthRequired: 'reauth_required',
  /** Con días de gracia, no se pudo programar el borrado (`unavailable`). */
  deletionNotScheduled: 'deletion_not_scheduled',
  /** La demo no escribe (`forbidden`); igual que `DEMO_READ_ONLY_ERROR`. */
  demoReadOnly: 'demo_read_only',
} as const
