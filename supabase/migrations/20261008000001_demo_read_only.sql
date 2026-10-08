-- ============================================================
-- Cuenta demo de solo lectura (E-DEMO)
--
-- La landing deja entrar a una cuenta de ejemplo para ver la app sin
-- registrarse. Esa cuenta (y sus amigos de ejemplo) llevan
-- `app_metadata.demo = true`, que solo puede poner el service role: el usuario
-- no puede editarse su propio `app_metadata`.
--
-- Aquí se le cierra la escritura a nivel de BASE, no solo de API: varios
-- componentes escriben directamente con el cliente de Supabase desde el
-- navegador (bio del perfil, posts de grupo, last_read_at del chat) y esos no
-- pasan por el middleware.
--
-- Políticas RESTRICTIVE: se combinan con AND con las permisivas que ya hay,
-- así que no amplían nada a nadie; solo le quitan la escritura a la demo.
-- El service role ignora RLS, así que el script de datos sigue pudiendo
-- rellenarla.
-- ============================================================

create or replace function public.is_demo_session()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'demo')::boolean, false)
$$;

do $$
declare
  t record;
begin
  -- Todas las tablas públicas con RLS activo, incluidas las que se creen con
  -- el mismo nombre de política en el futuro si se vuelve a ejecutar.
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format('drop policy if exists demo_no_insert on public.%I', t.relname);
    execute format('drop policy if exists demo_no_update on public.%I', t.relname);
    execute format('drop policy if exists demo_no_delete on public.%I', t.relname);

    execute format(
      'create policy demo_no_insert on public.%I as restrictive for insert to authenticated
         with check (not public.is_demo_session())', t.relname);
    execute format(
      'create policy demo_no_update on public.%I as restrictive for update to authenticated
         using (not public.is_demo_session()) with check (not public.is_demo_session())', t.relname);
    execute format(
      'create policy demo_no_delete on public.%I as restrictive for delete to authenticated
         using (not public.is_demo_session())', t.relname);
  end loop;
end
$$;
