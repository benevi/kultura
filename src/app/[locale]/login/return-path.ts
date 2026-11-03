import { safeInternalPath } from "@/lib/utils/safe-redirect";

/**
 * Páginas a las que no tiene sentido volver tras entrar: el propio acceso, la
 * contraseña nueva, los correos (confirmar, darse de baja) y la API.
 */
const NO_RETURN = /^\/(?:[a-z]{2}\/)?(?:login|reset-password|email|api|auth)(?:[/?#]|$)/;

/**
 * Vuelta a la página de origen cuando el enlace a /login no trae `next` (la
 * cabecera pública, «Entrar» en una ficha o un ranking): la página desde la
 * que se llegó, SOLO si es del mismo origen. Devuelve una ruta relativa
 * (`/es/best/anime/2025?x=1#3`) o `""` si no hay a dónde volver.
 *
 * Lo que sale de aquí pasa después por `resolveAuthNext`, igual que `next`:
 * nunca una URL absoluta, `//otro.sitio` ni la portada.
 */
export function referrerReturnPath(referrer: string | null | undefined, origin: string): string {
  if (!referrer || !origin) return "";
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return "";
  }
  if (url.origin !== origin) return "";
  const path = safeInternalPath(`${url.pathname}${url.search}${url.hash}`, "");
  if (!path || NO_RETURN.test(path)) return "";
  return path;
}
