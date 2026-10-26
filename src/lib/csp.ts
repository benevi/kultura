/**
 * KULTURA — Content-Security-Policy (C7, D-02)
 *
 * Dos políticas (D-02):
 *
 * - **Con nonce** (`buildCsp`): la genera `middleware.ts` en cada petición para
 *   todo lo que depende de quién mira (`(app)`, `/api`, `/login`, `/u/**`,
 *   `/media/**`, `/welcome`, `/report`…). Next añade ese nonce a los scripts
 *   que inyecta el framework.
 * - **Fija** (`buildStaticCsp`): la sirve `next.config.mjs` (`headers()`) en las
 *   rutas que se cachean en el CDN (`STATIC_CSP_ROUTES`). Un HTML cacheado no
 *   puede llevar un nonce por petición, y los hashes no son viables con los
 *   scripts inline del flight de Next (cambian por página y por build), así
 *   que aquí `script-src` es `'self' 'unsafe-inline'`, sin `unsafe-eval`. La
 *   excepción está firmada en el PR de F-22: en esas rutas no hay datos de
 *   usuario (todo lo pinta React, que escapa, y el JSON-LD escapa `<`).
 *
 * Dev:  'unsafe-eval' (+ ws/wss) para el HMR de webpack, y 'unsafe-inline' en
 *       script-src porque el nonce no es estable entre recompilaciones.
 *
 * style-src mantiene 'unsafe-inline' a propósito: Radix (Popover, etc.) fija
 * posición vía atributo `style=""` inline, que un nonce no cubre (los nonces
 * de CSP solo autorizan bloques <style>/<script>, no atributos `style=""`).
 *
 * Informes (SEG-10): las dos políticas mandan sus violaciones a
 * `/api/csp-report` (`report-uri` para Firefox/Safari, `report-to` para
 * Chromium con la cabecera `Reporting-Endpoints` de `next.config.mjs`). Además
 * va una política **solo de informe** con `connect-src` acotado
 * (`buildReportOnlyCsp`): no bloquea nada y, tras una semana de informes, dice
 * si se puede cerrar `connect-src 'self' https:` sin romper nada.
 *
 * ¡OJO! `next.config.mjs` no puede importar TypeScript: repite las mismas
 * cadenas y `tests/unit/csp/static-csp.test.ts` exige que coincidan.
 */

/** Ruta del receptor de informes y nombre del grupo de `Reporting-Endpoints`. */
export const CSP_REPORT_PATH = "/api/csp-report";
export const CSP_REPORT_GROUP = "csp";

const LOCALES = "es|en";

/**
 * Rutas cacheables en el CDN (D-02): portada de cada idioma, rankings,
 * legales y `/offline` (la crea F-23). Todo lo demás lleva nonce.
 */
export const STATIC_CSP_ROUTES: readonly RegExp[] = [
  new RegExp(`^/(${LOCALES})$`),
  new RegExp(`^/(${LOCALES})/best(/.*)?$`),
  new RegExp(`^/(${LOCALES})/(privacy|terms|legal|accessibility|offline)$`),
];

/** ¿Esta ruta (sin query) recibe la CSP fija de `next.config.mjs`? */
export function isStaticCspRoute(pathname: string): boolean {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return STATIC_CSP_ROUTES.some((re) => re.test(path));
}

// ── Rankings: URL válidas (F-22, revisión #47) ───────────────────────────────
// Los rankings se generan bajo demanda y se guardan en la caché ISR. Una URL
// inventada (/es/best/movie/abc) no debe llegar a la página: se escribiría en
// la caché (una entrada por URL basura). El middleware la manda a la 404
// dinámica antes. Copia ligera (apta para el edge) de `BEST_FORMATS`,
// `BEST_FIRST_YEAR` y `parseBestParams` de `src/lib/best/best-of.ts`;
// `tests/unit/csp/best-paths.test.ts` exige que digan lo mismo.
const BEST_FORMATS_EDGE = ["anime", "movie", "tv", "game"];
const BEST_FIRST_YEAR_EDGE = 2024;
const BEST_PATH = new RegExp(`^/(${LOCALES})/best(?:/(.*))?$`);

/**
 * `true` si la ruta es de /best pero no existe: formato desconocido, año que
 * no es de 4 cifras o fuera de [2024, año en curso], o segmentos de más. Las
 * tarjetas OG (`/best/{f}/{y}/opengraph-image…`) valen si formato y año valen.
 */
export function isInvalidBestPath(pathname: string, today: Date = new Date()): boolean {
  const match = BEST_PATH.exec(pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname);
  if (!match) return false;
  const rest = match[2] ? match[2].split("/") : [];
  if (rest.length === 0) return false;
  const [format, year, extra, ...more] = rest;
  if (!BEST_FORMATS_EDGE.includes(format)) return true;
  if (year === undefined) return false;
  if (!/^\d{4}$/.test(year)) return true;
  const y = Number(year);
  if (y < BEST_FIRST_YEAR_EDGE || y > today.getFullYear()) return true;
  if (extra === undefined) return false;
  return !(extra.startsWith("opengraph-image") && more.length === 0);
}

// ── Navegaciones del router desde una ruta con CSP fija (revisión #47) ────────
/**
 * ¿Pide esta petición una página con nonce desde JavaScript (el router de
 * Next) estando el navegador en una página con la CSP fija? Si se sirviera, la
 * página de destino se pintaría dentro del documento de origen y heredaría su
 * CSP `'unsafe-inline'`.
 *
 * Next quita al middleware las cabeceras del router (`RSC`,
 * `Next-Router-State-Tree`…, ver `FLIGHT_HEADERS` en `server/web/adapter`) y
 * el parámetro `_rsc`, así que se reconoce por lo que sí llega: una carga de
 * documento trae `Sec-Fetch-Dest: document`; el `fetch` del router, `empty`.
 * El origen es el `Referer` (la URL actual del documento; misma web, así que
 * `strict-origin-when-cross-origin` lo manda entero). Navegadores sin
 * `Sec-Fetch-*` (Safari < 16.4) no tienen esta red: la primera defensa son los
 * enlaces `<a>` de las páginas cacheables (test del grafo de imports).
 */
export function isRouterFetchFromStaticRoute(headers: Headers): boolean {
  if (headers.get("sec-fetch-dest") !== "empty") return false;
  try {
    return isStaticCspRoute(new URL(headers.get("referer") ?? "").pathname);
  } catch {
    return false;
  }
}

/** Directivas comunes a las dos políticas; solo cambia `script-src`. */
function directives(scriptSrc: string, connectSrc: string, isDev: boolean, reportOnly = false): string {
  return [
    "default-src 'self'",
    "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    connectSrc,
    "font-src 'self' data:",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    // SEG-10: nadie de fuera puede enmarcar la app (equivale a X-Frame-Options
    // SAMEORIGIN, que se mantiene para navegadores viejos) ni recibir sus
    // formularios (los de la demo envían a /api/auth/demo y redirigen dentro).
    "frame-ancestors 'self'",
    "form-action 'self'",
    // Solo en prod: en dev forzaría https://localhost y rompería los recursos.
    // Fuera de la de informe: ahí el navegador la ignora y lo dice en consola.
    isDev || reportOnly ? null : "upgrade-insecure-requests",
    // En dev no hay a quién avisar: el navegador ya lo enseña en consola.
    isDev ? null : `report-uri ${CSP_REPORT_PATH}`,
    isDev ? null : `report-to ${CSP_REPORT_GROUP}`,
  ]
    .filter(Boolean)
    .join("; ");
}

// ws/wss en dev para el WebSocket de Fast Refresh; wss://*.supabase.co para Realtime.
const CONNECT_SRC_PROD = "connect-src 'self' https: wss://*.supabase.co";
const CONNECT_SRC_DEV = "connect-src 'self' https: ws://localhost:* wss://localhost:* wss://*.supabase.co";

export function buildCsp({ nonce, isDev }: { nonce: string; isDev: boolean }): string {
  return directives(
    isDev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : `script-src 'self' 'nonce-${nonce}'`,
    isDev ? CONNECT_SRC_DEV : CONNECT_SRC_PROD,
    isDev,
  );
}

/**
 * CSP fija de las rutas cacheables (D-02). Sin nonce y sin `unsafe-eval` en
 * producción. En `next dev` es la misma que la de desarrollo con nonce (el
 * HMR necesita `unsafe-eval` y el WebSocket).
 */
export function buildStaticCsp({ isDev }: { isDev: boolean }): string {
  if (isDev) return buildCsp({ nonce: "", isDev: true });
  return directives("script-src 'self' 'unsafe-inline'", CONNECT_SRC_PROD, false);
}

/**
 * `connect-src` acotado a lo que la app pide desde el navegador: su propio
 * origen (API, `/_vercel/insights`), Supabase (REST, Auth y Realtime) y la
 * ingesta de Sentry. Solo para la política de informe: con una semana de
 * informes limpios pasa a la de verdad (SEG-10).
 */
export function narrowConnectSrc(supabaseUrl: string | undefined): string {
  const sources = ["'self'"];
  try {
    if (supabaseUrl) {
      const { host, origin } = new URL(supabaseUrl);
      sources.push(origin, `wss://${host}`);
    }
  } catch {
    // URL inválida: se queda solo 'self' y los informes lo dirán.
  }
  sources.push("https://*.ingest.sentry.io", "https://*.ingest.de.sentry.io");
  return `connect-src ${sources.join(" ")}`;
}

/**
 * Política solo de informe (`Content-Security-Policy-Report-Only`): la misma
 * que la de verdad con `connect-src` acotado. `script-src` no importa aquí
 * (se pone el de la fija para no duplicar informes de scripts).
 */
export function buildReportOnlyCsp(supabaseUrl: string | undefined): string {
  return directives("script-src 'self' 'unsafe-inline'", narrowConnectSrc(supabaseUrl), false, true);
}

/** Valor de `Reporting-Endpoints` (Chromium) para `report-to csp`. */
export const REPORTING_ENDPOINTS = `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"`;
