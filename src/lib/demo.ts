// ============================================================
// KULTURA — Cuenta demo de solo lectura (E-DEMO)
//
// La landing deja entrar a una cuenta de ejemplo, ya rellena, para enseñar la
// app sin pedir datos. Tres capas, y hacen falta las tres:
//   1. BASE: políticas RESTRICTIVE que le niegan insert/update/delete
//      (migración `demo_read_only`). Cubre lo que se escribe directamente
//      desde el navegador con el cliente de Supabase.
//   2. API: el middleware rechaza con 403 cualquier petición de escritura a
//      `/api/*` de una sesión demo. Cubre las rutas que escriben con el
//      cliente ADMIN (notificaciones, recomendaciones…), que ignora RLS.
//   3. UI: un aviso fijo en la app y un toast cuando algo se rechaza, para que
//      un "no se guardó" no parezca un error.
//
// La marca es `app_metadata.demo`, que solo puede escribir el service role:
// un usuario no puede ponérsela ni quitársela.
// ============================================================

/** Código de error que devuelve el middleware a una escritura de la demo. */
export const DEMO_READ_ONLY_ERROR = "demo_read_only";

/** Mínimo de lo que se mira de un usuario de Supabase. */
interface MaybeDemoUser {
  app_metadata?: Record<string, unknown> | null;
}

export function isDemoUser(user: MaybeDemoUser | null | undefined): boolean {
  return user?.app_metadata?.demo === true;
}

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * ¿Se rechaza esta petición a una sesión demo? Toda escritura a `/api/*`,
 * salvo las de `/api/auth/*`: entrar y SALIR de la demo también son POST, y
 * sin esa excepción la demo no podría cerrarse para ir a registrarse.
 */
export function isBlockedForDemo(method: string, pathname: string): boolean {
  if (READ_METHODS.has(method.toUpperCase())) return false;
  if (!pathname.startsWith("/api/")) return false;
  return !pathname.startsWith("/api/auth/");
}
