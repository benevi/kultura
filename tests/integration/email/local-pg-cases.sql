-- ============================================================
-- F-28 · Casos del doble opt-in en un PostgreSQL local (16) con TODAS las
-- migraciones aplicadas sobre una base "tipo Supabase" vacía (roles
-- anon/authenticated/service_role y auth.users mínimos). Lo mismo que
-- reconfirm.test.ts contra el proyecto de test, sin base remota.
--
--   psql "$LOCAL_PG_URL" -v ON_ERROR_STOP=1 -f tests/integration/email/local-pg-cases.sql
--
-- Termina con ERROR si un caso falla; si todo va bien, imprime "OK F-28".
-- Regresión (revisión #49): tras email_reconfirm_required, un enlace emitido
-- en el MISMO segundo (después de la baja) salía 'superseded': la baja tiene
-- microsegundos y la emisión del enlace, segundos. Dentro de una transacción
-- now() es fijo, así que el caso es determinista: con la comparación sin
-- truncar falla siempre (salvo now() exacto al segundo).
-- ============================================================

begin;

insert into auth.users (id, email) values ('f2800000-0000-4000-8000-000000000001', 'f28@example.com');
insert into public.users (id, username, avatar_color, avatar_initials)
values ('f2800000-0000-4000-8000-000000000001', 'f28_case', 'blue', 'F2')
on conflict (id) do nothing;

set local role service_role;

do $$
declare
  u uuid := 'f2800000-0000-4000-8000-000000000001';
  h1 text := 'AAAAAAAAAAAAAAAAAAAAAA';
  h2 text := 'BBBBBBBBBBBBBBBBBBBBBB';
  r text;
begin
  -- Alta confirmada con la dirección 1.
  r := public.email_confirm_weekly(u, '2026-12-v1', h1, date_trunc('second', now()));
  if r <> 'ok' then raise exception 'caso 1: esperaba ok, salió %', r; end if;

  -- El envío semanal ve otra dirección: desactiva…
  if not public.email_reconfirm_required(u) then raise exception 'caso 2: esperaba true'; end if;

  -- …y firma el enlace nuevo después (mismo segundo, precisión de segundos).
  r := public.email_confirm_weekly(u, '2026-12-v1', h2, date_trunc('second', now()));
  if r <> 'ok' then raise exception 'caso 3 (regresión): enlace tras la reconfirmación salió %', r; end if;

  -- Un enlace emitido claramente ANTES de la baja sigue sin valer.
  perform public.email_reconfirm_required(u);
  r := public.email_confirm_weekly(u, '2026-12-v1', h2, date_trunc('second', now()) - interval '1 minute');
  if r <> 'superseded' then raise exception 'caso 4: esperaba superseded, salió %', r; end if;

  -- Pulsar dos veces el bueno: la segunda, unchanged.
  r := public.email_confirm_weekly(u, '2026-12-v1', h2, date_trunc('second', now()));
  if r <> 'ok' then raise exception 'caso 5: esperaba ok, salió %', r; end if;
  r := public.email_confirm_weekly(u, '2026-12-v1', h2, date_trunc('second', now()));
  if r <> 'unchanged' then raise exception 'caso 6: esperaba unchanged, salió %', r; end if;

  if (select confirmed_email_hash from public.email_preferences where user_id = u) <> h2 then
    raise exception 'caso 7: la huella guardada no es la de la dirección nueva';
  end if;
end $$;

reset role;
rollback;

select 'OK F-28' as resultado;
