/**
 * Navegadores integrados de las apps sociales (MOV-11).
 *
 * Google rechaza el inicio de sesión dentro de estos WebViews
 * (`disallowed_useragent`), justo donde llega el tráfico de Instagram, TikTok
 * o X. Se detectan para avisar antes de que el botón de Google lleve a un
 * error, y se ofrece abrir la página en el navegador del sistema.
 */

const IN_APP_UA =
  /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Messenger|TikTok|musical_ly|BytedanceWebview|Bytedance|Twitter|Line\/|Snapchat|Pinterest/i;

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
