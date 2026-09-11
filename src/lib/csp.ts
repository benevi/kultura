/**
 * KULTURA — Content-Security-Policy (C7)
 *
 * Construye el valor del header CSP. Vive fuera de `middleware.ts` para poder
 * testearse sin pasar por el runtime Edge de Next.js.
 *
 * Dev:  'unsafe-eval' (+ ws/wss) necesarios para webpack HMR de Next.js, y
 *       'unsafe-inline' en script-src porque el nonce no es estable entre
 *       recompilaciones de HMR.
 * Prod: script-src usa un nonce distinto por request (ver middleware.ts) en
 *       vez de 'unsafe-inline' — Next.js añade automáticamente ese nonce a
 *       los scripts que inyecta el framework.
 *
 * style-src mantiene 'unsafe-inline' a propósito: Radix (Popover, etc.) fija
 * posición vía atributo `style=""` inline, que un nonce no cubre (los nonces
 * de CSP solo autorizan bloques <style>/<script>, no atributos `style=""`).
 * Quitarlo requeriría 'unsafe-hashes' con un hash por valor dinámico — fuera
 * de alcance de C7, que es solo `script-src`.
 */
export function buildCsp({ nonce, isDev }: { nonce: string; isDev: boolean }): string {
  const directives = [
    "default-src 'self'",
    "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
    isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    // ws/wss necesario en dev para Fast Refresh WebSocket; wss://*.supabase.co para Realtime en prod
    isDev
      ? "connect-src 'self' https: ws://localhost:* wss://localhost:* wss://*.supabase.co"
      : "connect-src 'self' https: wss://*.supabase.co",
    "font-src 'self' data:",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
  ];

  return directives.join("; ");
}
