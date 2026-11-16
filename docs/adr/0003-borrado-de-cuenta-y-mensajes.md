# ADR 0003 · Borrado de cuenta: los mensajes se quedan, sin autor ni texto

- **Estado**: aceptada (Q6). En producción desde el 11-11-2026.
- **Fecha**: 2026-11-10.
- **Código**: `supabase/migrations/20261230000001_harden_grants_and_policies.sql` (punto 10) y `src/lib/account/service.ts`.

## Contexto

Al borrar una cuenta había que decidir qué pasa con los mensajes que esa persona mandó en conversaciones de dos. Había tres opciones:

- **Borrarlos en cascada.** Al otro usuario le desaparece la mitad de la conversación y lo que queda pierde el sentido.
- **Conservarlos tal cual.** Seguiría guardado el texto de alguien que pidió que se borraran sus datos.
- **Conservar el mensaje sin autor y sin texto.**

## Decisión

Se elige la tercera: el mensaje se conserva, pero sin autor y sin texto.

- `messages.sender_id` pasa a admitir `null`, con `ON DELETE SET NULL` hacia `users`.
- Un disparador `before update of sender_id` deja `content` vacío cuando `sender_id` pasa a `null`. No depende de que el código de la app se acuerde de hacerlo.
- El chat del otro usuario muestra «usuario eliminado» en lugar del nombre.

## Consecuencias

- La conversación conserva su forma: se ve que había mensajes y en qué momento, pero no su contenido.
- Ni el texto ni la identidad del autor sobreviven al borrado.
- El borrado lo hace el cron diario (`/api/cron/daily`). Con días de gracia, la cuenta se programa y se purga más tarde. Sin `CRON_SECRET`, la purga no se ejecuta.
- Ninguna consulta puede suponer que `messages.sender_id` siempre tiene valor.
