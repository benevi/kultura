/**
 * Sanea un destino de redirección para evitar open redirects.
 *
 * Solo se aceptan rutas internas absolutas (`/algo`). Se rechazan:
 *  - `null`/vacío
 *  - URLs absolutas (`https://evil.com`, `http://…`)
 *  - protocol-relative (`//evil.com`), que el navegador resuelve como externo
 *  - rutas con backslash (`/\evil.com`), que algunos navegadores normalizan a `//`
 *
 * En cualquier caso inseguro devuelve el fallback (`/` por defecto).
 */
export function safeInternalPath(raw: string | null | undefined, fallback = "/"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;
  if (raw.startsWith("/\\")) return fallback;
  return raw;
}
