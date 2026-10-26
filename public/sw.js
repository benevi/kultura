/* ============================================================
 * KULTURA — Service worker (MOV-2 con la corrección de VERIF-B, D-02)
 *
 * Qué hace y, sobre todo, qué NO hace:
 *  - `/_next/static/**` (JS, CSS y fuentes con hash en el nombre, inmutables):
 *    cache-first. Es lo único que se guarda de la red.
 *  - Navegaciones (HTML): SIEMPRE a la red. Nunca se guarda una página: la
 *    CSP lleva un nonce por petición y el HTML con sesión es de cada usuario.
 *    Si la red falla, se responde con `/{locale}/offline`, precacheada al
 *    instalar con sus estáticos (es la única página guardada, sin datos de
 *    nadie) y refrescada como mucho una vez al día.
 *  - `/api/*`, otros orígenes, métodos que no son GET, imágenes, RSC de Next:
 *    ni se tocan (el navegador hace lo de siempre).
 *
 * Versión y limpieza: al cambiar `VERSION` se crean cachés nuevas y `activate`
 * borra todas las `kultura-*` que no sean las actuales. Los estáticos con
 * hash se acumulan entre despliegues sin cambiar `VERSION`, así que su caché
 * se recorta a `MAX_STATIC_ENTRIES` (se van las más antiguas).
 *
 * Interruptor de emergencia: `NEXT_PUBLIC_PWA_SW=0` en Vercel hace que el
 * cliente des-registre este worker (`src/components/pwa/ServiceWorker.tsx`).
 *
 * Las funciones de enrutado son declaraciones de primer nivel y sin estado
 * para que `tests/unit/pwa/sw.test.ts` las pruebe ejecutando ESTE archivo.
 * ============================================================ */

const VERSION = "v1";
const CACHE_PREFIX = "kultura-";
const STATIC_CACHE = CACHE_PREFIX + "static-" + VERSION;
const OFFLINE_CACHE = CACHE_PREFIX + "offline-" + VERSION;
const CURRENT_CACHES = [STATIC_CACHE, OFFLINE_CACHE];
const MAX_STATIC_ENTRIES = 200;
/** La página offline se refresca como mucho una vez al día. */
const OFFLINE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const LOCALES = ["es", "en"];
const DEFAULT_LOCALE = "es";
const OFFLINE_PATHS = LOCALES.map(function (l) { return "/" + l + "/offline"; });

/**
 * Qué hacer con una petición: "static" (cache-first), "navigate" (red con
 * respaldo offline) o "bypass" (no se llama a `respondWith`).
 */
function routeRequest(request, origin) {
  if (request.method !== "GET") return "bypass";
  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return "bypass";
  }
  if (url.origin !== origin) return "bypass";
  if (url.pathname === "/api" || url.pathname.indexOf("/api/") === 0) return "bypass";
  // DevTools puede lanzar esta combinación, que `fetch` rechaza.
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") return "bypass";
  if (request.mode === "navigate") return "navigate";
  if (url.pathname.indexOf("/_next/static/") === 0) return "static";
  return "bypass";
}

/** Página offline del idioma de la URL (por defecto, español). */
function offlinePathFor(pathname) {
  const first = String(pathname || "").split("/")[1];
  const locale = LOCALES.indexOf(first) >= 0 ? first : DEFAULT_LOCALE;
  return "/" + locale + "/offline";
}

/**
 * Solo se guarda una respuesta propia, completa y sin redirección (una
 * redirigida no puede servir a una navegación y una 206 es un trozo).
 */
function isCacheable(response) {
  return Boolean(
    response &&
      response.status === 200 &&
      response.type === "basic" &&
      !response.redirected
  );
}

/** Cachés de KULTURA de versiones anteriores (las ajenas no se tocan). */
function staleCacheNames(names) {
  return names.filter(function (name) {
    return name.indexOf(CACHE_PREFIX) === 0 && CURRENT_CACHES.indexOf(name) < 0;
  });
}

/**
 * Estáticos que necesita la página offline para pintarse e hidratarse sin red
 * (scripts, hojas, fuentes). Se sacan de su HTML: de los `src`/`href`
 * (`/_next/static/…`) y de la carga RSC, donde Next los nombra sin la barra
 * inicial (`"static/chunks/app/%5Blocale%5D/offline/page-….js"`). Si falta
 * uno, React no hidrata y se ve la pantalla de error en lugar del aviso.
 */
function extractStaticAssets(html) {
  const found = String(html || "").match(/static\/(?:chunks|css|media)\/[A-Za-z0-9._~\-\/%()@+\[\]]+/g) || [];
  const unique = [];
  for (let i = 0; i < found.length; i++) {
    const path = "/_next/" + found[i].replace(/\\+$/, "");
    if (!/\.(?:js|css|woff2?|ttf|otf)$/.test(path)) continue;
    if (unique.indexOf(path) < 0) unique.push(path);
  }
  return unique;
}

/** Respuesta mínima si ni siquiera la página offline está guardada. */
function fallbackOfflineResponse(locale) {
  const en = locale === "en";
  const html =
    '<!doctype html><html lang="' + (en ? "en" : "es") + '"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>KULTURA</title></head>' +
    '<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0c0d14;color:#f4f4f6;font-family:system-ui,sans-serif;text-align:center;padding:24px">' +
    "<main><h1>" + (en ? "You're offline" : "Sin conexión") + "</h1><p>" +
    (en ? "Check your connection and try again." : "Comprueba tu conexión y vuelve a intentarlo.") +
    "</p></main></body></html>";
  return new Response(html, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Borra las entradas más antiguas hasta dejar `max`. */
async function trimCache(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

/**
 * Descarga las páginas offline y sus estáticos y los guarda JUNTOS en
 * `OFFLINE_CACHE` (que no se recorta: si el recorte de `STATIC_CACHE` se
 * llevara un chunk de la página offline, no hidrataría). Primero se descarga
 * todo y luego se escribe: un fallo a medias deja la copia anterior intacta.
 *
 * - `strictAssets: false` (instalación): las páginas son obligatorias (si
 *   falla una, la instalación falla y el navegador lo reintenta en la próxima
 *   visita) y los estáticos, un extra.
 * - `strictAssets: true` (refresco): o todo o nada.
 */
async function precacheOffline(strictAssets) {
  const pages = await Promise.all(
    OFFLINE_PATHS.map(async function (path) {
      const response = await fetch(path, { cache: "reload", credentials: "omit" });
      if (!isCacheable(response)) throw new Error("offline page " + path + ": " + response.status);
      return { path: path, response: response, html: await response.clone().text() };
    })
  );
  const assets = [];
  pages.forEach(function (page) {
    extractStaticAssets(page.html).forEach(function (a) { if (assets.indexOf(a) < 0) assets.push(a); });
  });
  const offline = await caches.open(OFFLINE_CACHE);
  const results = await Promise.allSettled(
    assets.map(async function (asset) {
      const hit = (await offline.match(asset)) || (await caches.match(asset, { cacheName: STATIC_CACHE }));
      if (hit) return { path: asset, response: hit };
      const response = await fetch(asset);
      if (!isCacheable(response)) throw new Error("asset " + asset + ": " + response.status);
      return { path: asset, response: response };
    })
  );
  if (strictAssets && results.some(function (r) { return r.status !== "fulfilled"; })) {
    throw new Error("offline assets incomplete");
  }
  const entries = pages.concat(
    results.filter(function (r) { return r.status === "fulfilled"; }).map(function (r) { return r.value; })
  );
  for (let i = 0; i < entries.length; i++) await offline.put(entries[i].path, entries[i].response);
  // Fuera lo que ya no usa ninguna página offline (chunks de despliegues viejos).
  const keep = entries.map(function (e) { return e.path; });
  const keys = await offline.keys();
  for (let i = 0; i < keys.length; i++) {
    if (keep.indexOf(new URL(keys[i].url).pathname) < 0) await offline.delete(keys[i]);
  }
}

/** ¿La copia de la página offline tiene más de `OFFLINE_MAX_AGE_MS`? */
function isStale(response, now) {
  if (!response) return true;
  const date = Date.parse(response.headers.get("date") || "");
  return !Number.isFinite(date) || now - date > OFFLINE_MAX_AGE_MS;
}

let refreshing = null;

/**
 * Tras una navegación con red, si la página offline guardada es de hace más
 * de un día, se vuelve a descargar (textos y chunks del despliegue actual).
 * Uno a la vez; si falla, se queda la de antes.
 */
function refreshOfflineIfStale(now) {
  if (refreshing) return refreshing;
  refreshing = (async function () {
    const cached = await caches.match(OFFLINE_PATHS[0], { cacheName: OFFLINE_CACHE });
    if (isStale(cached, now)) await precacheOffline(true);
  })()
    .catch(function () {})
    .then(function () { refreshing = null; });
  return refreshing;
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = (await cache.match(request)) || (await caches.match(request, { cacheName: OFFLINE_CACHE }));
  if (hit) return hit;
  const response = await fetch(request);
  if (isCacheable(response)) {
    await cache.put(request, response.clone());
    trimCache(cache, MAX_STATIC_ENTRIES).catch(function () {});
  }
  return response;
}

async function networkWithOfflineFallback(event) {
  try {
    const response = await fetch(event.request);
    event.waitUntil(refreshOfflineIfStale(Date.now()));
    return response;
  } catch (e) {
    const path = offlinePathFor(new URL(event.request.url).pathname);
    const cached = await caches.match(path, { cacheName: OFFLINE_CACHE });
    return cached || fallbackOfflineResponse(path.split("/")[1]);
  }
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    precacheOffline(false).then(function () {
      // No hay HTML guardado que pueda quedar desfasado: el worker nuevo
      // puede tomar el control en cuanto se instala.
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    (async function () {
      const names = await caches.keys();
      await Promise.all(staleCacheNames(names).map(function (name) { return caches.delete(name); }));
      // Sin "navigation preload" a propósito: con él activo, una navegación
      // que el worker deja pasar (`/api/auth/callback?code=…` de Google) podría
      // salir dos veces a la red y gastar un código de un solo uso.
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", function (event) {
  const route = routeRequest(event.request, self.location.origin);
  if (route === "static") event.respondWith(cacheFirst(event.request));
  else if (route === "navigate") event.respondWith(networkWithOfflineFallback(event));
});
