# NOW
> Una sola tarea activa.

## Estado

E45-c → ✅ CERRADO 2026-06-01 (is_public + RLS `is_group_member` SECURITY DEFINER + discover filtra privados + UI toggle/badge/join condicional + i18n; commit 759c1b3). E45 sigue [~] parcial: queda solo E45-d (invitaciones).

## Tarea activa

**E45-d (invitaciones a grupos) — EN PROGRESO**

- **d.1 (migración + backend) ✓** — tabla `group_invitations` + RLS + trigger accept→alta miembro + enum `notifications.type += group_invite`; tipos `supabase.ts`; endpoints invite/accept/reject; +23 tests. Migración `20260601000002_group_invitations.sql` **ya ejecutada en prod**.
- **d.2 (UI) — pendiente** — botón "invitar amigos" en grupo + branch `group_invite` en `NotificationsList` + i18n.
