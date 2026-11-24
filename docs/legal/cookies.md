# Cookies y almacenamiento del navegador

Inventario de todo lo que KULTURA guarda en el navegador. Lo cuenta `/privacy` (`legal.privacy.sections.analytics.list.*` en `messages/es.json` y `en.json`). Revisado el 24-11-2026 con un grep de `localStorage`, `sessionStorage`, `document.cookie`, `cookies.set` y `caches.` en `src/` y `public/sw.js`.

**Regla:** quien añada una cookie o una clave nueva la apunta aquí y en `/privacy` en el mismo PR. Si no es estrictamente necesaria ni la pide la persona (art. 22.2 LSSI), hace falta consentimiento, y eso hoy no existe en KULTURA.

## Cookies

| Nombre | Para qué | Duración | Atributos | Origen | Quién la lee | `/privacy` |
|---|---|---|---|---|---|---|
| `sb-<ref>-auth-token` (puede partirse en `.0`, `.1`…) y `sb-<ref>-auth-token-code-verifier` mientras dura un acceso por código (PKCE, p. ej. con Google; lo canjea `src/app/api/auth/callback/route.ts`) | Sesión de Supabase | Hasta cerrar sesión; como mucho 400 días (valor por defecto de `@supabase/ssr` 0.10) | `Path=/`, `SameSite=Lax`, no HttpOnly (la lee el cliente de Supabase) | `src/middleware.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts` | Servidor y cliente de Supabase en KULTURA | `session` |
| `NEXT_LOCALE` | Idioma elegido | De sesión (sin `Max-Age`: se borra al cerrar el navegador) | `SameSite=Lax` (por defecto de `next-intl` 4) | `src/middleware.ts` (next-intl); no se manda en páginas con CSP fija | Middleware, `src/app/api/auth/callback/route.ts`, `src/lib/media/request-locale.ts` | `locale` |
| `kultura_sala_prueba` | Ver «Sala» con la bandera en `prueba` | 60 días; `?on=0` la borra | Valor `1`, HttpOnly, `SameSite=Lax`, `Secure` en producción, `Path=/` | `src/app/api/sala-prueba/route.ts`, `src/lib/flags/sala.ts` | Servidor (`salaFichaEnabled`) | `sala` |

## Almacenamiento local y de sesión

| Clave | Dónde | Qué guarda | Duración | Origen | Quién la lee | `/privacy` |
|---|---|---|---|---|---|---|
| `kultura:pending-avatar-icon` | `localStorage` | El personaje elegido en el registro | Hasta terminar el alta | `src/hooks/useAuthFlow.ts` | El propio navegador al acabar el alta | `storage` |
| `kultura:import:v2:<user_id>` | `localStorage` | Huella del archivo, servicio de origen, fecha y resultado por fila (título y año emparejados); nunca el archivo | Se ignora a los 7 días; se borra con «Empezar de cero» o al guardar otra importación | `src/lib/import/import-storage.ts` | Solo el navegador | `import` |
| `kultura:import:v1` | `localStorage` | Versión antigua sin usuario | Se borra al guardar o limpiar | `src/lib/import/import-storage.ts` | Nadie (solo se borra) | `import` |
| `kultura.pwa.install` | `localStorage` | Visitas, última actividad, fecha de «Ahora no» e «instalada» | Sin caducidad; «Ahora no» vale 30 días | `src/components/pwa/install-policy.ts`, `InstallPrompt.tsx` | Solo el navegador (la instalación aparte va a `analytics_events` por `/api/pwa/installed`) | `install` |
| `kultura.pushOffer.dismissed` | `localStorage` | Fecha en que se pulsó «Ahora no» | Sin caducidad | `src/lib/push/offer.ts` | Solo el navegador | `push` |
| `kultura.pushOffer.shown` | `sessionStorage` | `1`: ya se ofreció en esta visita | Hasta cerrar la pestaña | `src/lib/push/offer.ts` | Solo el navegador | `push` |

## Caché del service worker

| Nombre | Qué guarda | Duración | Origen | `/privacy` |
|---|---|---|---|---|
| `kultura-static-<versión>` | `/_next/static/**` (código, estilos, fuentes) | Hasta cambiar de versión; recortada a `MAX_STATIC_ENTRIES` | `public/sw.js` (se registra en la zona con sesión, `PwaShell`) | `cache` |
| `kultura-offline-<versión>` | `/{locale}/offline` y sus estáticos, sin datos de nadie | Hasta cambiar de versión; se refresca como mucho una vez al día | `public/sw.js` | `cache` |

Sin cookies de terceros ni analítica con cookies (Vercel Web Analytics no las usa). El tráiler de YouTube va con `youtube-nocookie.com` y solo carga al pulsar (`providers.p4`).
