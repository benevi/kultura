# Inventario de notificaciones (fase 8 · H17)

Todo lo que KULTURA avisa hoy, por canal, a 16-11-2026. Sirve de base para las reglas de retención ética de la fase 8 (`docs/PLAN_FASE8.md` §6.5):
- **RET-01:** cada aviso dice por qué llega.
- **RET-02:** ninguna push sin opt-in, y como mucho una al día.

## Dentro de la app (`public.notifications`, lista en `/notifications`)

La restricción `notifications_type_check` (producción) admite 4 tipos:

| Tipo | Cuándo | Lo crea | Bandera | RET-01 (dice por qué) |
|---|---|---|---|---|
| `recommendation` | Un amigo te recomienda un título | `src/app/api/recommendations/route.ts` | — | Sí: «X te recomienda Y» |
| `list_invite` | Te invitan a una lista compartida | `src/lib/lists/service.ts` | — | Sí |
| `group_invite` | Te invitan a un grupo | `src/lib/groups/service.ts` | — | Sí |
| `invite_accepted` | Alguien se registra con tu enlace de invitación | `src/lib/analytics/invite.ts` | `INVITE_NOTIFY` (**apagada** en producción) | Sí |

Además, sin fila en `notifications`:
- **Contador de no leídos** en la cabecera (`AuthHeader`, desde el layout de `(app)`).
- **Solicitudes de amistad** en Amigos. En `NotificationsList` hay un color `friend_request`, pero no es un tipo de la tabla.

## Push (Web Push)

| Aviso | Cuándo | Opt-in | Tope | Estado |
|---|---|---|---|---|
| Mensaje de chat | Mensaje nuevo en una conversación | Sí: el navegador pide permiso tras el aviso de `push-offer` | Uno por ráfaga y conversación (`push_throttle`); **no hay tope diario** | **Apagado**: `PUSH_ENABLED` off y las migraciones `push` y `push_throttle` sin aplicar en producción (Q14) |
| Notificación de la app | Cada fila nueva de `notifications` | Igual | Igual | Igual |

Lo dispara un trigger (`push_on_event`, con `pg_net`) que llama a `/api/push/dispatch` (`src/lib/push/dispatch.ts`). El aviso dice quién escribe, nunca el texto.

## Correo

| Correo | Cuándo | Opt-in | Estado |
|---|---|---|---|
| Confirmación de cuenta y cambio de contraseña | Alta, recuperación | No hace falta (correo del servicio) | **Activo** (Supabase Auth) |
| Resumen semanal | Lunes, por `/api/cron/daily` (`src/lib/email/digest.ts`) | Doble opt-in (`src/lib/email/optin.ts`), baja con un clic | **Apagado**: `WEEKLY_EMAIL` off (Q22) |
| Aviso de denuncia al moderador | Cada denuncia nueva (`src/lib/email/moderation.ts`) | — (solo al dueño) | **Apagado**: sin `RESEND_API_KEY` ni `MODERATION_EMAIL` (Q22). Hoy llega como aviso de Sentry |

## Huecos frente a §6.5

- **RET-02, tope diario:** la push, cuando se active, solo agrupa por ráfaga. Falta el máximo de una al día antes de encender `PUSH_ENABLED` (fuera del saneamiento, Q14).
- **RET-01:** los cuatro tipos dicen quién y qué. No hay avisos de recordatorio, rachas ni urgencia.
- **Sin preferencias por tipo:** no se pueden apagar tipos concretos dentro de la app. Encaja con `user_preferences` (8A.2, P-4).
