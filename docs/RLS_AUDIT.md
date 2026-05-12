# RLS Audit — B3.5g-AUDIT-RLS-1

> Inventario y clasificación de policies RLS en producción (`zfrbyphzvfuvejdwjfea`).
> Fecha: 2026-05-12
> Total auditado: 49 policies, 4 funciones SECURITY DEFINER.
> **Este documento es solo lectura. Las modificaciones se hacen en B3.5g-AUDIT-RLS-2.**

## 1. Resumen ejecutivo

| Veredicto | Count | % |
|---|---|---|
| 🟢 Verde | 46 | 93.9% |
| 🟡 Amarilla | 3 | 6.1% |
| 🔴 Roja | 0 | 0% |
| ⚪ Gris | 0 | 0% |
| **Total** | **49** | **100%** |

No se encontraron recursiones activas. FIX2/FIX3 resolvieron correctamente la recursión en `conversation_members` mediante la función SECURITY DEFINER `is_conversation_member`. Las 3 políticas 🟡 son hallazgos de calidad: una INSERT con `WITH CHECK: true` en `conversations` (permisividad excesiva) y dos políticas UPDATE idénticas en `users` (duplicado conocido E23). No hay ninguna 🔴 — B3.5g-AUDIT-RLS-2 puede centrarse exclusivamente en las 3 amarillas. Se detectan además 2 notas de sección 6 que no disparan criterio de color: `reports` sin SELECT policy, y uso sistémico de `roles={public}` en lugar de `{authenticated}` en ~30 políticas.

## 2. Tabla resumen por tabla

| Tabla | Total policies | 🟢 | 🟡 | 🔴 | ⚪ |
|---|---|---|---|---|---|
| conversation_members | 3 | 3 | 0 | 0 | 0 |
| conversations | 2 | 1 | 1 | 0 | 0 |
| friendships | 4 | 4 | 0 | 0 | 0 |
| group_members | 3 | 3 | 0 | 0 | 0 |
| group_posts | 3 | 3 | 0 | 0 | 0 |
| groups | 4 | 4 | 0 | 0 | 0 |
| list_items | 3 | 3 | 0 | 0 | 0 |
| list_members | 3 | 3 | 0 | 0 | 0 |
| lists | 4 | 4 | 0 | 0 | 0 |
| media | 3 | 3 | 0 | 0 | 0 |
| messages | 2 | 2 | 0 | 0 | 0 |
| notifications | 2 | 2 | 0 | 0 | 0 |
| recommendations | 3 | 3 | 0 | 0 | 0 |
| reports | 1 | 1 | 0 | 0 | 0 |
| suggestions | 2 | 2 | 0 | 0 | 0 |
| user_media | 4 | 4 | 0 | 0 | 0 |
| users | 3 | 1 | 2 | 0 | 0 |
| **Total** | **49** | **46** | **3** | **0** | **0** |

## 3. Lista detallada por veredicto

### 🔴 Rojas

_Ninguna._

### 🟡 Amarillas

#### conversations.Authenticated users can create conversations
- **cmd:** INSERT
- **roles:** {authenticated}
- **qual:** `null`
- **with_check:** `true`
- **Criterio:** 4 — policy usa `true` en `with_check` para `cmd = INSERT` sin justificación obvia. Cualquier usuario autenticado puede crear una conversación sin restricción de contenido ni destinatario.
- **Hipótesis de fix:** Añadir `WITH CHECK (auth.uid() IS NOT NULL)` como mínimo, o bien confiar en que el Route Handler valida el flujo y documentar explícitamente la decisión de dejar la policy permisiva. No requiere SECURITY DEFINER. Baja prioridad — el riesgo funcional es bajo porque los miembros se añaden por separado en `conversation_members`.

#### users.users can update own profile
- **cmd:** UPDATE
- **roles:** {public}
- **qual:** `(auth.uid() = id)`
- **with_check:** `null`
- **Criterio:** 3 — hay dos policies UPDATE con predicado idéntico (`auth.uid() = id`) para la misma tabla y roles solapados (`{public}`). La ambigüedad no causa fallo visible porque ambas permiten la misma operación, pero es ruido de seguridad documentado en E23.
- **Hipótesis de fix:** Eliminar una de las dos con una migración `supabase migration new dedupe_users_update_policies`. Ver E23 en BACKLOG. Requiere decidir cuál de los dos nombres retener.

#### users.users_update_own
- **cmd:** UPDATE
- **roles:** {public}
- **qual:** `(auth.uid() = id)`
- **with_check:** `null`
- **Criterio:** 3 — duplicado exacto de `users can update own profile`. Mismo predicado, mismo cmd, roles solapados. Ver entrada anterior.
- **Hipótesis de fix:** Idem — eliminar junto con la entrada anterior en la misma migración de deduplicación.

### ⚪ Grises

_Ninguna._

### 🟢 Verdes

Listado breve (tabla.policyname — cmd):

- `conversation_members.Users can join conversations` — INSERT
- `conversation_members.Users can view conversation members they belong to` — SELECT
- `conversation_members.Users can update their own read status` — UPDATE
- `conversations.Members can view their conversations` — SELECT
- `friendships.friendships_delete_own` — DELETE
- `friendships.friendships_insert_as_requester` — INSERT
- `friendships.friendships_select_own` — SELECT
- `friendships.friendships_update_as_receiver` — UPDATE
- `group_members.Group owners can manage members` — INSERT
- `group_members.Members can view group membership` — SELECT
- `group_members.Users can leave groups` — DELETE
- `group_posts.Group members can post` — INSERT
- `group_posts.Group members can view posts` — SELECT
- `group_posts.Post authors can delete their posts` — DELETE
- `groups.Authenticated users can view groups` — SELECT
- `groups.Owners can delete groups` — DELETE
- `groups.Owners can update groups` — UPDATE
- `groups.Users can create groups` — INSERT
- `list_items.list_items_delete_adder_or_owner` — DELETE
- `list_items.list_items_insert_member_or_owner` — INSERT
- `list_items.list_items_select_public` — SELECT
- `list_members.list_members_delete_owner_or_self` — DELETE
- `list_members.list_members_insert_owner` — INSERT
- `list_members.list_members_select_public` — SELECT
- `lists.lists_delete_own` — DELETE
- `lists.lists_insert_own` — INSERT
- `lists.lists_select_public` — SELECT
- `lists.lists_update_own` — UPDATE
- `media.media_insert_auth` — INSERT
- `media.media_select_all` — SELECT
- `media.media_update_auth` — UPDATE
- `messages.Members can send messages` — INSERT
- `messages.Members can view messages` — SELECT
- `notifications.notifications_select_own` — SELECT
- `notifications.notifications_update_own` — UPDATE
- `recommendations.recommendations_insert_as_sender` — INSERT
- `recommendations.recommendations_select_own` — SELECT
- `recommendations.recommendations_update_as_receiver` — UPDATE
- `reports.reports_insert_auth` — INSERT
- `suggestions.Users can insert suggestions` — INSERT
- `suggestions.Users can view own suggestions` — SELECT
- `user_media.user_media_delete_own` — DELETE
- `user_media.user_media_insert_own` — INSERT
- `user_media.user_media_select_public` — SELECT
- `user_media.user_media_update_own` — UPDATE
- `users.users_select_public` — SELECT

## 4. Funciones SECURITY DEFINER

- **Nombre:** `public.handle_new_group()`
- **Volatilidad:** VOLATILE
- **Lenguaje:** plpgsql
- **Estado:** ✅ correcta
- **Notas:** Trigger `AFTER INSERT ON groups`. Inserta al `owner_id` como miembro inicial en `group_members` con `role='owner'`. Sin subqueries con riesgo de recursión.

---

- **Nombre:** `public.handle_new_message()`
- **Volatilidad:** VOLATILE
- **Lenguaje:** plpgsql
- **Estado:** ✅ correcta
- **Notas:** Trigger `AFTER INSERT ON messages`. Actualiza `conversations.last_message_at`. Sin subqueries con riesgo de recursión.

---

- **Nombre:** `public.handle_new_user()`
- **Volatilidad:** VOLATILE
- **Lenguaje:** plpgsql
- **Estado:** ⚠️ revisar
- **Notas:** Trigger `AFTER INSERT ON auth.users`. Lee `public.users` en un bucle `WHILE EXISTS` para resolver duplicados de username. No hay recursión porque `users` no tiene policies que consulten de vuelta `auth.users`. La advertencia es de otra naturaleza: la función tiene `SECURITY DEFINER` pero **no especifica `SET search_path`** en la versión del baseline — sin embargo, la versión live sí incluye `SET search_path TO 'public'` (confirmado en Apéndice B). ✅ en producción; la advertencia aplica solo si se despliega el baseline sin este parámetro.

---

- **Nombre:** `public.is_conversation_member(conv_id uuid, uid uuid)`
- **Volatilidad:** STABLE
- **Lenguaje:** sql
- **Estado:** ✅ correcta
- **Notas:** Creada en FIX2 (B3.5c-3-FIX2). Usada por las policies INSERT y SELECT de `conversation_members` para evitar recursión. STABLE + SECURITY DEFINER + `SET search_path TO 'public'` — correctamente parametrizada. No expone datos, solo devuelve boolean.

## 5. Plan de refactor para B3.5g-AUDIT-RLS-2

Lista priorizada. Sin 🔴, se trabajan las 3 🟡:

1. **users.users can update own profile + users.users_update_own** — eliminar una de las dos policies duplicadas UPDATE en `users`.
   - Migration sugerida: `supabase migration new dedupe_users_update_policies` → `DROP POLICY "users can update own profile" ON public.users;`
   - Tests E2E a reforzar: `tests/e2e/auth.spec.ts` (cubre settings/profile update) — verificar que UPDATE de perfil sigue funcionando con una sola policy.
   - Prioridad: alta (deuda conocida E23, trivial, sin riesgo).

2. **conversations.Authenticated users can create conversations** — evaluar si `WITH CHECK: true` es intencional o accidental.
   - Dos opciones: (a) documentar que es intencional (el Route Handler valida) añadiendo un comentario en el SQL; (b) restringir a `WITH CHECK (auth.uid() IS NOT NULL)` o añadir validación de destinatario.
   - Migration sugerida (si se elige b): `supabase migration new harden_conversations_insert_policy`
   - Tests E2E a reforzar: `tests/e2e/chat.spec.ts` — verificar creación de conversación sigue funcionando.
   - Prioridad: baja (riesgo funcional bajo — Route Handler ya valida).

Orden de aplicación: (1) primero, es una limpieza sin riesgo. (2) segundo, requiere decisión de producto.

## 6. Decisiones y notas

### Anomalías del inventario

- **`reports` sin SELECT policy:** La tabla `reports` tiene RLS habilitado y solo una policy INSERT. No hay policy SELECT — ningún rol (ni `authenticated` ni `anon`) puede leer reports vía cliente normal. En producción, la tabla es solo para recibir reportes de usuarios; la consulta la haría un admin via `service_role` (que bypasea RLS). Funcionalmente intencionado, pero no documentado explícitamente. Añadir a BACKLOG como E-task si se quiere añadir una policy `reports_select_service_role` o documentar la decisión.

- **`notifications` sin INSERT policy:** La tabla `notifications` tiene RLS con solo SELECT+UPDATE. No hay INSERT desde cliente — los inserts los hace el service_role desde Route Handlers. Intencional y correcto.

- **`messages` sin DELETE policy:** Usuarios no pueden borrar mensajes. Intencional por diseño (historial permanente). Correcto.

- **Conteo confirmado:** `SELECT count(*) = 49` en producción (`zfrbyphzvfuvejdwjfea`). Sin desviación respecto al snapshot de B2.

### Suposiciones de clasificación

- Las policies de `messages` (`Members can send messages`, `Members can view messages`) consultan `conversation_members`. Se asume 🟢 porque `conversation_members` SELECT policy llama a `is_conversation_member` (SECURITY DEFINER, bypasea RLS), eliminando la posibilidad de recursión transitiva.

- Las policies de `conversations` SELECT (`Members can view their conversations`) consultan `conversation_members`. Mismo razonamiento: cadena rota por SECURITY DEFINER en `is_conversation_member`. 🟢.

- Las policies de `group_posts` consultan `group_members`. `group_members` SELECT policy es `true` (sin subqueries). No hay riesgo de recursión. 🟢.

- Las policies de `list_items` y `list_members` consultan `lists`. `lists` SELECT policy es `true`. No hay riesgo de recursión. 🟢.

### Patrón `roles={public}` sistémico

Aproximadamente 30 de las 49 policies muestran `roles={public}` (en lugar de `{authenticated}`). Esto ocurre cuando la policy no declara `TO authenticated` explícitamente. Funcionalmente seguro porque los predicados `auth.uid() = ...` retornan false para `anon` (uid=null). Sin embargo, es una práctica subóptima: permite que el motor de Postgres evalúe la policy para usuarios anónimos antes de descartar. No se clasifica como 🟡 porque no representa riesgo de seguridad real ni ambigüedad funcional. Se documenta como deuda de calidad menor.

## Apéndice A — Volcado bruto de `pg_policies`

```
schemaname | tablename            | policyname                                          | permissive | roles            | cmd    | qual                                                                                                                                                                             | with_check
-----------+----------------------+-----------------------------------------------------+------------+------------------+--------+----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+--------------------------------------------------------------------------------------------------------------------------------------------------------------------------
public     | conversation_members | Users can join conversations                        | PERMISSIVE | {authenticated}  | INSERT | null                                                                                                                                                                             | ((user_id = auth.uid()) OR is_conversation_member(conversation_id, auth.uid()))
public     | conversation_members | Users can view conversation members they belong to  | PERMISSIVE | {authenticated}  | SELECT | ((user_id = auth.uid()) OR is_conversation_member(conversation_id, auth.uid()))                                                                                                 | null
public     | conversation_members | Users can update their own read status              | PERMISSIVE | {authenticated}  | UPDATE | (user_id = auth.uid())                                                                                                                                                           | null
public     | conversations        | Authenticated users can create conversations        | PERMISSIVE | {authenticated}  | INSERT | null                                                                                                                                                                             | true
public     | conversations        | Members can view their conversations                | PERMISSIVE | {authenticated}  | SELECT | (EXISTS ( SELECT 1 FROM conversation_members WHERE ((conversation_members.conversation_id = conversations.id) AND (conversation_members.user_id = auth.uid()))))                 | null
public     | friendships          | friendships_delete_own                              | PERMISSIVE | {public}         | DELETE | ((auth.uid() = requester_id) OR (auth.uid() = receiver_id))                                                                                                                     | null
public     | friendships          | friendships_insert_as_requester                     | PERMISSIVE | {public}         | INSERT | null                                                                                                                                                                             | (auth.uid() = requester_id)
public     | friendships          | friendships_select_own                              | PERMISSIVE | {public}         | SELECT | ((auth.uid() = requester_id) OR (auth.uid() = receiver_id))                                                                                                                     | null
public     | friendships          | friendships_update_as_receiver                      | PERMISSIVE | {public}         | UPDATE | (auth.uid() = receiver_id)                                                                                                                                                       | null
public     | group_members        | Users can leave groups                              | PERMISSIVE | {authenticated}  | DELETE | (user_id = auth.uid())                                                                                                                                                           | null
public     | group_members        | Group owners can manage members                     | PERMISSIVE | {authenticated}  | INSERT | null                                                                                                                                                                             | (EXISTS ( SELECT 1 FROM groups WHERE ((groups.id = group_members.group_id) AND (groups.owner_id = auth.uid()))))
public     | group_members        | Members can view group membership                   | PERMISSIVE | {authenticated}  | SELECT | true                                                                                                                                                                             | null
public     | group_posts          | Post authors can delete their posts                 | PERMISSIVE | {authenticated}  | DELETE | (user_id = auth.uid())                                                                                                                                                           | null
public     | group_posts          | Group members can post                              | PERMISSIVE | {authenticated}  | INSERT | null                                                                                                                                                                             | ((user_id = auth.uid()) AND (EXISTS ( SELECT 1 FROM group_members WHERE ((group_members.group_id = group_posts.group_id) AND (group_members.user_id = auth.uid())))))
public     | group_posts          | Group members can view posts                        | PERMISSIVE | {authenticated}  | SELECT | (EXISTS ( SELECT 1 FROM group_members WHERE ((group_members.group_id = group_posts.group_id) AND (group_members.user_id = auth.uid()))))                                        | null
public     | groups               | Owners can delete groups                            | PERMISSIVE | {authenticated}  | DELETE | (owner_id = auth.uid())                                                                                                                                                          | null
public     | groups               | Users can create groups                             | PERMISSIVE | {authenticated}  | INSERT | null                                                                                                                                                                             | (owner_id = auth.uid())
public     | groups               | Authenticated users can view groups                 | PERMISSIVE | {authenticated}  | SELECT | true                                                                                                                                                                             | null
public     | groups               | Owners can update groups                            | PERMISSIVE | {authenticated}  | UPDATE | (owner_id = auth.uid())                                                                                                                                                          | null
public     | list_items           | list_items_delete_adder_or_owner                    | PERMISSIVE | {public}         | DELETE | ((auth.uid() = added_by) OR (auth.uid() = ( SELECT lists.owner_id FROM lists WHERE (lists.id = list_items.list_id))))                                                           | null
public     | list_items           | list_items_insert_member_or_owner                   | PERMISSIVE | {public}         | INSERT | null                                                                                                                                                                             | ((auth.uid() = added_by) AND ((auth.uid() = ( SELECT lists.owner_id FROM lists WHERE (lists.id = list_items.list_id))) OR (EXISTS ( SELECT 1 FROM list_members WHERE ((list_members.list_id = list_items.list_id) AND (list_members.user_id = auth.uid()))))))
public     | list_items           | list_items_select_public                            | PERMISSIVE | {public}         | SELECT | true                                                                                                                                                                             | null
public     | list_members         | list_members_delete_owner_or_self                   | PERMISSIVE | {public}         | DELETE | ((auth.uid() = user_id) OR (auth.uid() = ( SELECT lists.owner_id FROM lists WHERE (lists.id = list_members.list_id))))                                                          | null
public     | list_members         | list_members_insert_owner                           | PERMISSIVE | {public}         | INSERT | null                                                                                                                                                                             | (auth.uid() = ( SELECT lists.owner_id FROM lists WHERE (lists.id = list_members.list_id)))
public     | list_members         | list_members_select_public                          | PERMISSIVE | {public}         | SELECT | true                                                                                                                                                                             | null
public     | lists                | lists_delete_own                                    | PERMISSIVE | {public}         | DELETE | (auth.uid() = owner_id)                                                                                                                                                          | null
public     | lists                | lists_insert_own                                    | PERMISSIVE | {public}         | INSERT | null                                                                                                                                                                             | (auth.uid() = owner_id)
public     | lists                | lists_select_public                                 | PERMISSIVE | {public}         | SELECT | true                                                                                                                                                                             | null
public     | lists                | lists_update_own                                    | PERMISSIVE | {public}         | UPDATE | (auth.uid() = owner_id)                                                                                                                                                          | null
public     | media                | media_insert_auth                                   | PERMISSIVE | {public}         | INSERT | null                                                                                                                                                                             | (auth.role() = 'authenticated'::text)
public     | media                | media_select_all                                    | PERMISSIVE | {public}         | SELECT | true                                                                                                                                                                             | null
public     | media                | media_update_auth                                   | PERMISSIVE | {public}         | UPDATE | (auth.role() = 'authenticated'::text)                                                                                                                                            | null
public     | messages             | Members can send messages                           | PERMISSIVE | {authenticated}  | INSERT | null                                                                                                                                                                             | ((sender_id = auth.uid()) AND (EXISTS ( SELECT 1 FROM conversation_members WHERE ((conversation_members.conversation_id = messages.conversation_id) AND (conversation_members.user_id = auth.uid())))))
public     | messages             | Members can view messages                           | PERMISSIVE | {authenticated}  | SELECT | (EXISTS ( SELECT 1 FROM conversation_members WHERE ((conversation_members.conversation_id = messages.conversation_id) AND (conversation_members.user_id = auth.uid()))))        | null
public     | notifications        | notifications_select_own                            | PERMISSIVE | {public}         | SELECT | (auth.uid() = user_id)                                                                                                                                                           | null
public     | notifications        | notifications_update_own                            | PERMISSIVE | {public}         | UPDATE | (auth.uid() = user_id)                                                                                                                                                           | null
public     | recommendations      | recommendations_insert_as_sender                    | PERMISSIVE | {public}         | INSERT | null                                                                                                                                                                             | (auth.uid() = from_user_id)
public     | recommendations      | recommendations_select_own                          | PERMISSIVE | {public}         | SELECT | ((auth.uid() = from_user_id) OR (auth.uid() = to_user_id))                                                                                                                      | null
public     | recommendations      | recommendations_update_as_receiver                  | PERMISSIVE | {public}         | UPDATE | (auth.uid() = to_user_id)                                                                                                                                                        | null
public     | reports              | reports_insert_auth                                 | PERMISSIVE | {public}         | INSERT | null                                                                                                                                                                             | (auth.uid() = reporter_id)
public     | suggestions          | Users can insert suggestions                        | PERMISSIVE | {authenticated}  | INSERT | null                                                                                                                                                                             | (user_id = auth.uid())
public     | suggestions          | Users can view own suggestions                      | PERMISSIVE | {authenticated}  | SELECT | (user_id = auth.uid())                                                                                                                                                           | null
public     | user_media           | user_media_delete_own                               | PERMISSIVE | {public}         | DELETE | (auth.uid() = user_id)                                                                                                                                                           | null
public     | user_media           | user_media_insert_own                               | PERMISSIVE | {public}         | INSERT | null                                                                                                                                                                             | (auth.uid() = user_id)
public     | user_media           | user_media_select_public                            | PERMISSIVE | {public}         | SELECT | true                                                                                                                                                                             | null
public     | user_media           | user_media_update_own                               | PERMISSIVE | {public}         | UPDATE | (auth.uid() = user_id)                                                                                                                                                           | null
public     | users                | users_select_public                                 | PERMISSIVE | {public}         | SELECT | true                                                                                                                                                                             | null
public     | users                | users can update own profile                        | PERMISSIVE | {public}         | UPDATE | (auth.uid() = id)                                                                                                                                                                | null
public     | users                | users_update_own                                    | PERMISSIVE | {public}         | UPDATE | (auth.uid() = id)                                                                                                                                                                | null
```

## Apéndice B — Funciones SECURITY DEFINER (definición completa)

### public.handle_new_group()

```sql
CREATE OR REPLACE FUNCTION public.handle_new_group()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  insert into group_members (group_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$function$
```

### public.handle_new_message()

```sql
CREATE OR REPLACE FUNCTION public.handle_new_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  update conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$function$
```

### public.handle_new_user()

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  raw_username text;
  clean_username text;
  final_username text;
  counter int := 0;
begin
  -- 1. Extraer la parte antes del @ del email
  raw_username := split_part(new.email, '@', 1);

  -- 2. Eliminar caracteres no permitidos (solo a-z, A-Z, 0-9, _)
  clean_username := regexp_replace(raw_username, '[^a-zA-Z0-9_]', '', 'g');

  -- 3. Garantizar longitud mínima si el email-prefix queda vacío
  if length(clean_username) = 0 then
    clean_username := 'user';
  end if;

  -- 4. Truncar a 15 caracteres (deja margen para sufijo numérico hasta 99999)
  clean_username := left(clean_username, 15);
  final_username := clean_username;

  -- 5. Resolver duplicados añadiendo sufijo numérico incremental
  while exists (select 1 from users where username = final_username) loop
    counter := counter + 1;
    final_username := clean_username || counter::text;
  end loop;

  -- 6. Insertar perfil de usuario
  begin
    insert into users (id, username, avatar_initials, avatar_color)
    values (
      new.id,
      final_username,
      upper(left(final_username, 2)),
      '#E82020'
    );
  exception when others then
    raise exception 'handle_new_user failed for user %: %', new.id, sqlerrm;
  end;

  return new;
end;
$function$
```

### public.is_conversation_member(conv_id uuid, uid uuid)

```sql
CREATE OR REPLACE FUNCTION public.is_conversation_member(conv_id uuid, uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM conversation_members
    WHERE conversation_id = conv_id
      AND user_id = uid
  );
$function$
```
