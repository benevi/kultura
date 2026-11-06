-- R9 (04_DECISIONES): registrar en el historial de PRODUCCIÓN las 22 migraciones
-- que ya están aplicadas (verificado objeto a objeto el 2026-11-06).
-- Equivale a `supabase migration repair --status applied <22 versiones>`.
-- Idempotente: solo inserta las que faltan. No toca el esquema ni los datos.
-- NO incluye 20261222330001_push ni 20261222340001_push_throttle (sin aplicar).
insert into supabase_migrations.schema_migrations (version, name)
select v, n from (values
  ('20260531000001', 'fix_group_members_self_join'),
  ('20260531180450', 'rpc_discover_groups'),
  ('20260531201838', 'drop_rpc_discover_groups'),
  ('20260601000001', 'add_group_visibility'),
  ('20260601000002', 'group_invitations'),
  ('20260716000001', 'dm_only_between_friends'),
  ('20260913220000', 'avatar_and_group_icons'),
  ('20260914090000', 'media_translations'),
  ('20261008000001', 'demo_read_only'),
  ('20261014000001', 'public_lists'),
  ('20261023020001', 'harden_rls'),
  ('20261023030001', 'media_server_only'),
  ('20261023040001', 'ai_budget'),
  ('20261101110001', 'moderation'),
  ('20261101120001', 'identity_privacy'),
  ('20261115170001', 'analytics'),
  ('20261208240001', 'rating10_logs'),
  ('20261208250001', 'platforms_mixed_lists'),
  ('20261215270001', 'progress'),
  ('20261215280001', 'calendar_email'),
  ('20261215290001', 'adaptations'),
  ('20261229350001', 'landing_media')
) as t(v, n)
where not exists (
  select 1 from supabase_migrations.schema_migrations s where s.version = t.v
)
returning version;
