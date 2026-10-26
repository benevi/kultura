/**
 * Reintento desde la página offline: `null` = recargar la URL actual (la que
 * falló); si la URL es la propia `/…/offline`, la portada.
 */
export function retryTarget(pathname: string, homeHref: string): string | null {
  return /\/offline\/?$/.test(pathname) ? homeHref : null;
}
