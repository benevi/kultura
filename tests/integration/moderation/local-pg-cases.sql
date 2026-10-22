-- Casos de F-11 contra la migración aplicada en un Postgres local (sin Supabase).
-- Cada caso imprime "OK <caso>" o aborta con "FALLO <caso>".
-- Uso, en una base vacía:
--   psql -d f11 -f tests/integration/moderation/local-pg-stub.sql
--   for f in supabase/migrations/*.sql; do
--     sed '/supabase_vault\|pg_graphql\|pg_stat_statements/d' "$f" | psql -d f11 -v ON_ERROR_STOP=1 -f -
--   done
--   psql -d f11 -f tests/integration/moderation/local-pg-cases.sql
\set ON_ERROR_STOP 1

create or replace function t_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;
create or replace function t_reset() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', false);
end $$;
grant execute on function t_as(uuid), t_reset() to authenticated, anon;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'ana@t.es'),
  ('00000000-0000-4000-8000-00000000000b', 'bea@t.es'),
  ('00000000-0000-4000-8000-00000000000c', 'carla@t.es'),
  ('00000000-0000-4000-8000-00000000000d', 'dani@t.es'),
  ('00000000-0000-4000-8000-00000000000e', 'eva@t.es'),
  ('00000000-0000-4000-8000-00000000000f', 'fran@t.es'),
  ('00000000-0000-4000-8000-000000000010', 'gema@t.es');

\set ana '''00000000-0000-4000-8000-00000000000a'''
\set bea '''00000000-0000-4000-8000-00000000000b'''
\set carla '''00000000-0000-4000-8000-00000000000c'''
\set dani '''00000000-0000-4000-8000-00000000000d'''
\set eva '''00000000-0000-4000-8000-00000000000e'''
\set fran '''00000000-0000-4000-8000-00000000000f'''
\set gema '''00000000-0000-4000-8000-000000000010'''

insert into public.friendships (requester_id, receiver_id, status) values
  (:ana, :bea, 'accepted'), (:ana, :carla, 'accepted'), (:ana, :dani, 'accepted'),
  (:eva, :fran, 'accepted'), (:eva, :gema, 'accepted');

-- Ayudas: ¿una sentencia falla con RLS / error? (se ejecuta como el usuario dado)
create or replace function t_fails(uid uuid, stmt text) returns boolean language plpgsql as $$
begin
  perform t_as(uid);
  begin
    execute stmt;
  exception when others then
    perform t_reset();
    return true;
  end;
  perform t_reset();
  return false;
end $$;
create or replace function t_rows(uid uuid, stmt text) returns int language plpgsql as $$
declare n int;
begin
  perform t_as(uid);
  execute 'with x as (' || stmt || ') select count(*) from x' into n;
  perform t_reset();
  return n;
exception when others then
  perform t_reset();
  raise;
end $$;
create or replace function t_check(name text, ok boolean) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FALLO %', name; end if;
  raise notice 'OK %', name;
end $$;
create or replace function t_conv(a uuid, b uuid) returns uuid language plpgsql as $$
declare c uuid;
begin
  perform t_as(a);
  select public.create_conversation_with_members(b) into c;
  perform t_reset();
  return c;
end $$;

-- ── Bloqueo con amistad ────────────────────────────────────────────────
do $$
declare
  ana uuid := '00000000-0000-4000-8000-00000000000a';
  bea uuid := '00000000-0000-4000-8000-00000000000b';
  conv uuid := t_conv(ana, bea);
begin
  perform t_check('con amistad se escribe',
    not t_fails(bea, format('insert into public.messages (conversation_id, sender_id, content) values (%L, %L, %L)', conv, bea, 'hola')));
  perform t_check('bloquear (fila propia)',
    not t_fails(ana, format('insert into public.blocks (blocker_id, blocked_id) values (%L, %L)', ana, bea)));
  perform t_check('bloquear borra la amistad',
    not exists (select 1 from public.friendships where (requester_id = ana and receiver_id = bea) or (requester_id = bea and receiver_id = ana)));
  perform t_check('tras bloquear, el bloqueado no escribe',
    t_fails(bea, format('insert into public.messages (conversation_id, sender_id, content) values (%L, %L, %L)', conv, bea, 'x')));
  perform t_check('tras bloquear, quien bloquea tampoco',
    t_fails(ana, format('insert into public.messages (conversation_id, sender_id, content) values (%L, %L, %L)', conv, ana, 'x')));
  perform t_check('el bloqueado no vuelve a pedir amistad',
    t_fails(bea, format('insert into public.friendships (requester_id, receiver_id, status) values (%L, %L, %L)', bea, ana, 'pending')));
  perform t_check('el bloqueado no ve la fila del bloqueo',
    t_rows(bea, 'select 1 from public.blocks') = 0);
  perform t_check('no se bloquea uno a sí mismo',
    t_fails(ana, format('insert into public.blocks (blocker_id, blocked_id) values (%L, %L)', ana, ana)));
  perform t_check('no se bloquea en nombre de otro',
    t_fails(bea, format('insert into public.blocks (blocker_id, blocked_id) values (%L, %L)', ana, bea)));
end $$;

-- ── Solo bloqueo (amistad recreada por el servidor) ────────────────────
do $$
declare
  eva uuid := '00000000-0000-4000-8000-00000000000e';
  fran uuid := '00000000-0000-4000-8000-00000000000f';
  gema uuid := '00000000-0000-4000-8000-000000000010';
  conv uuid := t_conv(eva, fran);
begin
  perform t_check('solo bloqueo: eva bloquea a fran y a gema',
    not t_fails(eva, format('insert into public.blocks (blocker_id, blocked_id) values (%L, %L), (%L, %L)', eva, fran, eva, gema)));
  insert into public.friendships (requester_id, receiver_id, status) values (eva, fran, 'accepted'), (gema, eva, 'accepted');
  perform t_check('solo bloqueo: con amistad recreada, fran sigue sin escribir',
    t_fails(fran, format('insert into public.messages (conversation_id, sender_id, content) values (%L, %L, %L)', conv, fran, 'x')));
  perform t_check('solo bloqueo: eva tampoco',
    t_fails(eva, format('insert into public.messages (conversation_id, sender_id, content) values (%L, %L, %L)', conv, eva, 'x')));
  perform t_check('solo bloqueo: create_conversation_with_members falla (eva → gema)',
    t_fails(eva, format('select public.create_conversation_with_members(%L)', gema)));
  perform t_check('solo bloqueo: create_conversation_with_members falla (gema → eva)',
    t_fails(gema, format('select public.create_conversation_with_members(%L)', eva)));
  perform t_check('has_block_with solo responde sobre quien pregunta (fran no ve el de eva con gema)',
    t_rows(fran, format('select 1 where public.has_block_with(%L)', gema)) = 0
    and t_rows(gema, format('select 1 where public.has_block_with(%L)', eva)) = 1);
end $$;

-- ── Dejar de ser amigos ────────────────────────────────────────────────
do $$
declare
  ana uuid := '00000000-0000-4000-8000-00000000000a';
  carla uuid := '00000000-0000-4000-8000-00000000000c';
  conv uuid := t_conv(ana, carla);
begin
  perform t_check('amigos: carla escribe',
    not t_fails(carla, format('insert into public.messages (conversation_id, sender_id, content) values (%L, %L, %L)', conv, carla, 'hola')));
  perform t_as(ana);
  delete from public.friendships where (requester_id = ana and receiver_id = carla);
  perform t_reset();
  perform t_check('tras dejar de ser amigos, carla no escribe',
    t_fails(carla, format('insert into public.messages (conversation_id, sender_id, content) values (%L, %L, %L)', conv, carla, 'x')));
end $$;

-- ── Salir del chat ─────────────────────────────────────────────────────
do $$
declare
  ana uuid := '00000000-0000-4000-8000-00000000000a';
  dani uuid := '00000000-0000-4000-8000-00000000000d';
  conv uuid := t_conv(ana, dani);
begin
  perform t_check('dani no saca a ana de la conversación',
    t_rows(dani, format('delete from public.conversation_members where conversation_id = %L and user_id = %L returning 1', conv, ana)) = 0);
  perform t_check('dani sale (borra su pertenencia)',
    t_rows(dani, format('delete from public.conversation_members where conversation_id = %L and user_id = %L returning 1', conv, dani)) = 1);
  perform t_check('dani ya no lee la conversación',
    t_rows(dani, format('select 1 from public.messages where conversation_id = %L', conv)) = 0);
  perform t_check('con solo ana dentro, no se puede escribir',
    t_fails(ana, format('insert into public.messages (conversation_id, sender_id, content) values (%L, %L, %L)', conv, ana, 'x')));
  perform t_rows(ana, format('delete from public.conversation_members where conversation_id = %L and user_id = %L returning 1', conv, ana));
  perform t_check('al salir el último, la conversación se borra',
    not exists (select 1 from public.conversations where id = conv));
end $$;

-- ── Grupos: dueño, miembro, veto ───────────────────────────────────────
do $$
declare
  ana uuid := '00000000-0000-4000-8000-00000000000a';
  carla uuid := '00000000-0000-4000-8000-00000000000c';
  dani uuid := '00000000-0000-4000-8000-00000000000d';
  g uuid := gen_random_uuid();
  p uuid;
begin
  insert into public.groups (id, owner_id, name, is_public) values (g, ana, 'F11', true);
  perform t_check('dani entra en el grupo público',
    not t_fails(dani, format('insert into public.group_members (group_id, user_id, role) values (%L, %L, %L)', g, dani, 'member')));
  perform t_check('carla entra en el grupo público',
    not t_fails(carla, format('insert into public.group_members (group_id, user_id, role) values (%L, %L, %L)', g, carla, 'member')));
  insert into public.group_posts (group_id, user_id, content) values (g, dani, 'spam') returning id into p;
  perform t_check('carla (no dueña) no borra el post de dani',
    t_rows(carla, format('delete from public.group_posts where id = %L returning 1', p)) = 0);
  perform t_check('carla no expulsa a dani',
    t_rows(carla, format('delete from public.group_members where group_id = %L and user_id = %L returning 1', g, dani)) = 0);
  perform t_check('la dueña borra el post de dani',
    t_rows(ana, format('delete from public.group_posts where id = %L returning 1', p)) = 1);
  perform t_check('la dueña veta a dani',
    not t_fails(ana, format('insert into public.group_bans (group_id, user_id, banned_by) values (%L, %L, %L)', g, dani, ana)));
  perform t_check('el veto le expulsa',
    not exists (select 1 from public.group_members where group_id = g and user_id = dani));
  perform t_check('vetado no vuelve a entrar solo',
    t_fails(dani, format('insert into public.group_members (group_id, user_id, role) values (%L, %L, %L)', g, dani, 'member')));
  perform t_check('carla no veta (no es dueña)',
    t_fails(carla, format('insert into public.group_bans (group_id, user_id, banned_by) values (%L, %L, %L)', g, ana, carla)));
  perform t_check('la dueña no se expulsa a sí misma',
    t_rows(ana, format('delete from public.group_members where group_id = %L and user_id = %L returning 1', g, ana)) = 0);
  perform t_check('la dueña sigue siendo miembro owner',
    exists (select 1 from public.group_members where group_id = g and user_id = ana and role = 'owner'));
  perform t_check('carla sí puede salir',
    t_rows(carla, format('delete from public.group_members where group_id = %L and user_id = %L returning 1', g, carla)) = 1);
end $$;

-- ── Grupo privado sin RETURNING ────────────────────────────────────────
do $$
declare
  ana uuid := '00000000-0000-4000-8000-00000000000a';
  g uuid := gen_random_uuid();
  g2 uuid := gen_random_uuid();
begin
  perform t_check('grupo privado CON returning falla (el fallo que se arregla)',
    t_fails(ana, format('insert into public.groups (id, owner_id, name, is_public) values (%L, %L, %L, false) returning id', g2, ana, 'P')));
  perform t_check('grupo privado sin returning se crea',
    not t_fails(ana, format('insert into public.groups (id, owner_id, name, is_public) values (%L, %L, %L, false)', g, ana, 'P')));
  perform t_check('y la dueña lo lee después',
    t_rows(ana, format('select 1 from public.groups where id = %L', g)) = 1);
end $$;

-- ── Denuncias ──────────────────────────────────────────────────────────
do $$
declare
  ana uuid := '00000000-0000-4000-8000-00000000000a';
  bea uuid := '00000000-0000-4000-8000-00000000000b';
  r uuid := gen_random_uuid();
  n int;
begin
  insert into public.reports (id, reporter_id, contact_email, target_type, target_id, reason)
    values (gen_random_uuid(), null, 'v@example.com', 'list', gen_random_uuid()::text, 'spam');
  perform t_check('sin cuenta: resolved_at nulo',
    (select bool_and(resolved_at is null) from public.reports));
  perform t_check('con sesión: denuncia propia sin RETURNING',
    not t_fails(ana, format('insert into public.reports (id, reporter_id, target_type, target_id, reason) values (%L, %L, %L, %L, %L)', r, ana, 'message', gen_random_uuid(), 'harassment')));
  perform t_check('con sesión: solo ve las propias',
    t_rows(ana, 'select 1 from public.reports') = 1);
  perform t_check('no se denuncia en nombre de otro',
    t_fails(ana, format('insert into public.reports (reporter_id, target_type, target_id) values (%L, %L, %L)', bea, 'user', bea)));
  perform t_check('no se marca resuelta al crear',
    t_fails(ana, format('insert into public.reports (reporter_id, target_type, target_id, resolved_at) values (%L, %L, %L, now())', ana, 'user', bea)));
  perform t_check('tipo inválido rechazado',
    t_fails(ana, format('insert into public.reports (reporter_id, target_type, target_id) values (%L, %L, %L)', ana, 'review', 'x')));
  -- anon
  execute 'set role anon';
  begin
    select count(*) into n from public.reports;
    execute 'reset role';
    perform t_check('anon no lee reports', false);
  exception when insufficient_privilege then
    execute 'reset role';
    perform t_check('anon no lee reports (permiso denegado)', true);
  end;
end $$;

select tabla, ok from public.rls_audit() where not ok;
select count(*) as demo_policies from pg_policies
 where schemaname = 'public' and tablename in ('blocks','group_bans') and policyname like 'demo_no_%';
