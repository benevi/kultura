import { routing } from "@/i18n/routing";

const LOCALES = routing.locales as readonly string[];

/**
 * Sanea un destino de redirección para evitar open redirects.
 *
 * Solo se aceptan rutas internas absolutas (`/algo`). Se rechazan:
 *  - `null`/vacío
 *  - URLs absolutas (`https://evil.com`, `http://…`)
 *  - protocol-relative (`//evil.com`), que el navegador resuelve como externo
 *  - cualquier barra invertida (`/\evil.com`), que algunos navegadores
 *    normalizan a `/`
 *  - espacios y caracteres de control: el navegador quita tabuladores y saltos
 *    de línea de una URL, así que `/\t/evil.com` acabaría siendo `//evil.com`
 *
 * En cualquier caso inseguro devuelve el fallback (`/` por defecto).
 */
export function safeInternalPath(raw: string | null | undefined, fallback = "/"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;
  if (raw.includes("\\")) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001F\u007F]/.test(raw)) return fallback;
  return raw;
}

/** Locale del primer segmento de una ruta (`/en/home` → `en`), o `null`. */
export function localeFromPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const match = /^\/([^/?#]+)/.exec(path);
  const first = match?.[1] ?? null;
  return first && LOCALES.includes(first) ? first : null;
}

/** ¿Es la ruta la pantalla de entrar (con o sin locale)? Volver ahí sería un bucle. */
function isLoginPath(path: string): boolean {
  return /^\/(?:[a-z]{2}\/)?login(?:[/?#]|$)/.test(path);
}

/**
 * Destino tras entrar, registrarse o canjear un enlace del correo.
 *
 * Parte de `safeInternalPath` y además:
 *  - sin destino válido → `/{locale}/home`;
 *  - una ruta sin locale (`/library`) recibe el del usuario;
 *  - nunca vuelve al login (bucle), a la API ni a la portada (quien acaba de
 *    entrar no quiere la landing: va a su inicio).
 */
export function resolveAuthNext(raw: string | null | undefined, locale: string): string {
  const home = `/${locale}/home`;
  const path = safeInternalPath(raw, "");
  if (!path || path === "/") return home;
  if (path === "/api" || path.startsWith("/api/") || path.startsWith("/api?")) return home;

  const localized = localeFromPath(path) ? path : `/${locale}${path}`;
  const withoutLocale = localized.replace(/^\/[^/?#]+/, "") || "/";
  if (withoutLocale === "/" || /^[?#]/.test(withoutLocale)) return home;
  if (isLoginPath(withoutLocale)) return home;
  return localized;
}

/**
 * URL del login para una página privada a la que se llegó sin sesión: un solo
 * salto, ya con locale, y la página original como `next` (si se conoce y es
 * segura).
 */
export function loginRedirectPath(locale: string, currentPath: string | null | undefined): string {
  const base = `/${locale}/login`;
  const path = safeInternalPath(currentPath, "");
  if (!path) return base;
  const home = `/${locale}/home`;
  const next = resolveAuthNext(path, locale);
  // Si el saneado lo ha cambiado por el inicio, no aporta nada como `next`.
  if (next === home && path !== home) return base;
  return `${base}?next=${encodeURIComponent(next)}`;
}
