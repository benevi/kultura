/**
 * Navegadores integrados de las apps sociales (MOV-11).
 *
 * Google rechaza el inicio de sesión dentro de estos WebViews
 * (`403 disallowed_useragent`), justo donde llega el tráfico de Instagram,
 * TikTok, X, Facebook o LinkedIn. En ellos el botón de Google no se pinta (ni
 * en el HTML del servidor, que ya lee el user agent): primero el correo, y una
 * línea para abrir la página en el navegador del sistema con el enlace copiado.
 *
 * Además de las apps por nombre, cualquier WebView de Android (`; wv)` en el
 * user agent): Google también los bloquea. Las pestañas personalizadas de
 * Chrome (WhatsApp, Telegram) no llevan esa marca y sí pueden usar Google.
 */

const IN_APP_UA =
  /Instagram|Barcelona|FBAN|FBAV|FB_IAB|FBIOS|Messenger|TikTok|musical_ly|BytedanceWebview|Bytedance|Twitter|LinkedInApp|Line\/|Snapchat|Pinterest|; wv\)/i;

export interface InAppBrowser {
  /** Android: se puede intentar abrir Chrome con un enlace `intent://`. */
  android: boolean;
}

export function detectInAppBrowser(userAgent: string | null | undefined): InAppBrowser | null {
  if (!userAgent || !IN_APP_UA.test(userAgent)) return null;
  return { android: /Android/i.test(userAgent) };
}

/**
 * Enlace `intent://` que abre la misma URL en Chrome (Android). Si Chrome no
 * está instalado, Android cae a la `browser_fallback_url` (la propia URL).
 */
export function chromeIntentUrl(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const scheme = url.protocol.replace(":", "");
  const rest = `${url.host}${url.pathname}${url.search}`;
  return (
    `intent://${rest}#Intent;scheme=${scheme};package=com.android.chrome;` +
    `S.browser_fallback_url=${encodeURIComponent(url.toString())};end`
  );
}
