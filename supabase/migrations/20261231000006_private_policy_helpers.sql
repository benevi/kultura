-- ============================================================
-- KULTURA — Saneamiento 12.2: funciones de las políticas fuera de la API
--
-- Estas cinco funciones SECURITY DEFINER solo las usan políticas RLS, pero al
-- estar en `public` PostgREST las publicaba en /rest/v1/rpc/…:
--   - can_read_list: la podía llamar cualquiera SIN sesión (aviso 0028 de
--     Supabase): oráculo de "¿existe esta lista y es pública?".
--   - is_banned_from_group, is_conversation_member, is_group_member,
--     is_group_owner: oráculos de pertenencia para cualquier usuario.
--
-- Se mueven al esquema `private`, que la API no expone (config.toml →
-- api.schemas = public, graphql_public). Las políticas guardan la función por
-- su OID, así que siguen funcionando sin tocarlas; los permisos EXECUTE y el
-- search_path de cada función se conservan. Ninguna otra función las llama
-- por su nombre (comprobado en kultura-test el 13-11-2026) y la app no las
-- llama por rpc.
--
-- `anon` y `authenticated` necesitan USAGE en el esquema para que la política
-- pueda ejecutar la función; con eso no pasan a ser llamables por la API.
--
-- Se quedan en public (la app las llama por rpc): can_read_library,
-- can_send_message, has_block_with, create_conversation_with_members y
-- set_email_weekly (ver supabase/security-allowlist.json).
--
-- Deshacer:
--   alter function private.can_read_list(uuid) set schema public;  -- y las otras 4
-- ============================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

alter function public.can_read_list(uuid) set schema private;
alter function public.is_banned_from_group(uuid) set schema private;
alter function public.is_conversation_member(uuid, uuid) set schema private;
alter function public.is_group_member(uuid, uuid) set schema private;
alter function public.is_group_owner(uuid, uuid) set schema private;

-- Comprobación: ninguna de las cinco queda en public.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('can_read_list', 'is_banned_from_group', 'is_conversation_member',
                         'is_group_member', 'is_group_owner')
  ) then
    raise exception 'saneamiento 12.2: alguna función de las políticas sigue en public';
  end if;
end $$;
