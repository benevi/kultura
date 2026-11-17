-- ============================================================
-- KULTURA · Fase 8 · Métricas (8.2 «Medir», puerta P-Números, G4/G6)
--
-- SOLO LECTURA Y SOLO AGREGADOS. Una única sentencia `select`; no escribe
-- nada. La salida nunca lleva user_id, correos, nombres de usuario ni filas
-- individuales (tampoco el `ref` de la atribución, que es un nombre de usuario).
--
-- CÓMO SE USA
--   · SQL Editor de Supabase o la herramienta MCP `execute_sql` (rol postgres
--     o service_role: lee auth.users, que la API pública no ve).
--   · Fecha de corte: por defecto now(). Para repetir una medición (P-Números:
--     4 semanas después de cada cambio grande) se cambia la ÚNICA línea
--     marcada con «CORTE» en la CTE `params`, por ejemplo:
--         select timestamptz '2026-12-15 00:00:00+00' as corte
--   · Guardar el resultado (solo las cifras) en el informe de la fase, con la
--     fecha de corte: esa es la línea base con la que se compara después.
--
-- DEFINICIONES
--   · Ventana a N días: (corte - N días, corte]. Semanas: ISO (lunes), en UTC.
--   · ENTRADA: un registro nuevo de una obra por una persona en un día:
--       - fila nueva en public.user_media (obra añadida a la biblioteca), o
--       - fila nueva en public.user_media_logs (visionado/lectura en el diario),
--     por `created_at`. Añadir una obra y anotarla en el diario el mismo día
--     cuenta UNA entrada (se deduplica por persona + obra + día UTC). Los
--     componentes van también por separado (`entradas_biblioteca`,
--     `entradas_diario`). Cambiar estado, nota o progreso de una obra que ya
--     estaba NO es una entrada (no deja historial: solo `updated_at`).
--   · USUARIO ACTIVO: persona con al menos una escritura propia en su
--     biblioteca o diario en la ventana: fila creada o modificada
--     (`created_at` o `updated_at`) en user_media o user_media_logs. Entrar a
--     mirar no cuenta (no se mide: `last_sign_in_at` solo guarda el último
--     acceso y no permite repetir la medición).
--   · ENTRADAS POR USUARIO ACTIVO: entradas de la ventana / activos de la
--     ventana (media). Se da también la mediana por activo, porque con pocos
--     usuarios una sola persona que añade muchas obras mueve la media.
--   · ALTA: cuenta nueva en auth.users (por `created_at`). `altas_confirmadas`
--     = con correo confirmado.
--   · ORIGEN DEL ALTA: `raw_user_meta_data -> 'attribution'` (lo guarda
--     src/lib/analytics/signup.ts desde la migración 20261115170001_analytics):
--       canal = utm | ref | direct; fuente = utm_source.
--     Las cuentas anteriores a esa fecha salen como «sin dato». Además,
--     proveedor de acceso (`raw_app_meta_data ->> 'provider'`: email, google…),
--     que dice CÓMO se registró, no de dónde vino.
--     Las visitas anónimas no están en la base: salen de Vercel Web Analytics.
--   · CUENTAS EXCLUIDAS: solo la cuenta demo (`raw_app_meta_data.demo = true`,
--     la única marca objetiva del esquema). No hay marca de cuenta interna o de
--     pruebas: las cuentas del equipo cuentan como cualquier otra.
--
-- PRIVACIDAD (grupos pequeños)
--   · En los desgloses por origen, toda categoría con menos de 3 cuentas se
--     suma en «otros (<3)».
--   · Las mediciones a 7 días con 1 o 2 activos describen a personas concretas:
--     se usan para ver la tendencia, no se publican.
--
-- LÍMITES CONOCIDOS
--   · `updated_at` solo guarda la última modificación: los ACTIVOS de un corte
--     pasado pueden salir algo más bajos que cuando se midieron (quien volvió a
--     tocar la misma fila después «sale» de la ventana antigua). Las entradas y
--     las altas sí son repetibles, salvo filas o cuentas borradas después.
--     Por eso la línea base se GUARDA al medirla; no se recalcula.
--   · Una migración que reescriba filas de user_media sin desactivar el
--     disparador `user_media_set_updated_at` inflaría los activos.
--   · Con tan pocos usuarios, una diferencia de 1 o 2 activos es ruido.
--
-- SALIDA: bloque | metrica | periodo | detalle | valor
-- ============================================================

with params as (
  select now() as corte                                              -- CORTE
),
ventanas as (
  select v.periodo, v.dias, p.corte, p.corte - make_interval(days => v.dias) as desde
    from params p
   cross join (values ('7d', 7), ('30d', 30)) as v(periodo, dias)
),
-- Cuentas que cuentan: todas menos la demo, creadas hasta el corte.
cuentas as (
  select a.id,
         a.created_at,
         a.email_confirmed_at is not null                                   as confirmada,
         coalesce(a.raw_user_meta_data -> 'attribution' ->> 'channel', 'sin dato') as canal,
         case
           when a.raw_user_meta_data -> 'attribution' is null then 'sin dato'
           else coalesce(a.raw_user_meta_data -> 'attribution' ->> 'utm_source', 'sin utm_source')
         end                                                                as fuente,
         coalesce(a.raw_app_meta_data ->> 'provider', 'sin dato')           as proveedor
    from auth.users a
   cross join params p
   where a.created_at <= p.corte
     and not coalesce((a.raw_app_meta_data ->> 'demo')::boolean, false)
),
-- Entradas (creaciones) de biblioteca y diario, de cuentas que cuentan.
creaciones as (
  select um.user_id, um.media_id, um.created_at, 'biblioteca'::text as tipo
    from public.user_media um
    join cuentas c on c.id = um.user_id
  union all
  select l.user_id, l.media_id, l.created_at, 'diario'::text
    from public.user_media_logs l
    join cuentas c on c.id = l.user_id
),
-- Cualquier escritura propia (creación o modificación): define «activo».
actividad as (
  select user_id, created_at as ts from creaciones
  union all
  select um.user_id, um.updated_at
    from public.user_media um
    join cuentas c on c.id = um.user_id
   where um.updated_at is not null
  union all
  select l.user_id, l.updated_at
    from public.user_media_logs l
    join cuentas c on c.id = l.user_id
   where l.updated_at is not null
),
activos as (
  select v.periodo, count(distinct a.user_id) as n
    from ventanas v
    left join actividad a on a.ts > v.desde and a.ts <= v.corte
   group by v.periodo
),
-- Entradas deduplicadas por persona + obra + día (UTC), por ventana.
entradas_usuario as (
  select v.periodo, cr.user_id,
         count(distinct (cr.media_id, (cr.created_at at time zone 'UTC')::date)) as entradas,
         count(*) filter (where cr.tipo = 'biblioteca')                          as biblioteca,
         count(*) filter (where cr.tipo = 'diario')                              as diario
    from ventanas v
    join creaciones cr on cr.created_at > v.desde and cr.created_at <= v.corte
   group by v.periodo, cr.user_id
),
-- Una fila por activo y ventana (0 entradas si solo modificó), para la mediana.
entradas_por_activo as (
  select v.periodo, act.user_id, coalesce(eu.entradas, 0) as entradas
    from ventanas v
    join (select distinct v2.periodo, a.user_id
            from ventanas v2
            join actividad a on a.ts > v2.desde and a.ts <= v2.corte) act
      on act.periodo = v.periodo
    left join entradas_usuario eu on eu.periodo = v.periodo and eu.user_id = act.user_id
),
entradas as (
  select v.periodo,
         coalesce(sum(eu.entradas), 0)   as entradas,
         coalesce(sum(eu.biblioteca), 0) as biblioteca,
         coalesce(sum(eu.diario), 0)     as diario
    from ventanas v
    left join entradas_usuario eu on eu.periodo = v.periodo
   group by v.periodo
),
mediana as (
  select periodo,
         percentile_cont(0.5) within group (order by entradas)::numeric as p50
    from entradas_por_activo
   group by periodo
),
altas as (
  select v.periodo,
         count(c.id)                             as n,
         count(c.id) filter (where c.confirmada) as confirmadas
    from ventanas v
    left join cuentas c on c.created_at > v.desde and c.created_at <= v.corte
   group by v.periodo
),
semanas as (
  select (date_trunc('week', p.corte at time zone 'UTC') - make_interval(weeks => g.i))::date as semana
    from params p
   cross join generate_series(0, 11) as g(i)
),
altas_semana as (
  select s.semana, count(c.id) as n
    from semanas s
    left join cuentas c
      on date_trunc('week', c.created_at at time zone 'UTC')::date = s.semana
   group by s.semana
),
-- Origen: una fila por cuenta, dimensión y periodo (30 días y total).
origen_base as (
  select d.dimension, pr.periodo, d.categoria
    from cuentas c
   cross join params p
   cross join lateral (values ('altas_por_canal', c.canal),
                              ('altas_por_fuente_utm', c.fuente),
                              ('altas_por_proveedor', c.proveedor)) as d(dimension, categoria)
   cross join lateral (values ('30d', c.created_at > p.corte - interval '30 days'),
                              ('total', true)) as pr(periodo, dentro)
   where pr.dentro
),
origen_cat as (
  select dimension, periodo, categoria, count(*) as n
    from origen_base
   group by dimension, periodo, categoria
),
-- Categorías con menos de 3 cuentas → «otros (<3)».
origen as (
  select dimension, periodo,
         case when n < 3 then 'otros (<3)' else categoria end as categoria,
         sum(n) as n
    from origen_cat
   group by 1, 2, 3
),
salida as (
  select 0 as orden, 'corte'::text as bloque, 'fecha_de_corte_utc'::text as metrica, ''::text as periodo,
         to_char(p.corte at time zone 'UTC', 'YYYY-MM-DD HH24:MI') as detalle, null::numeric as valor
    from params p
  union all
  select 10, 'actividad', 'usuarios_activos', a.periodo, '', a.n from activos a
  union all
  select 11, 'actividad', 'entradas', e.periodo, '', e.entradas from entradas e
  union all
  select 12, 'actividad', 'entradas_por_usuario_activo', e.periodo, 'media',
         round(e.entradas::numeric / nullif(a.n, 0), 2)
    from entradas e join activos a using (periodo)
  union all
  select 13, 'actividad', 'entradas_por_usuario_activo', v.periodo, 'mediana', round(m.p50, 2)
    from ventanas v left join mediana m using (periodo)
  union all
  select 14, 'actividad', 'entradas_biblioteca', e.periodo, 'sin deduplicar', e.biblioteca from entradas e
  union all
  select 15, 'actividad', 'entradas_diario', e.periodo, 'sin deduplicar', e.diario from entradas e
  union all
  select 20, 'altas', 'altas', al.periodo, '', al.n from altas al
  union all
  select 21, 'altas', 'altas_confirmadas', al.periodo, '', al.confirmadas from altas al
  union all
  select 22, 'altas', 'altas', 'total', '', count(*) from cuentas
  union all
  select 23, 'altas', 'altas_confirmadas', 'total', '', count(*) filter (where confirmada) from cuentas
  union all
  select 30, 'altas_por_semana', 'altas_semana', to_char(s.semana, 'YYYY-MM-DD'), 'lunes UTC', s.n
    from altas_semana s
  union all
  select 40, 'origen', o.dimension, o.periodo, o.categoria, o.n from origen o
)
select bloque, metrica, periodo, detalle, valor
  from salida
 order by orden, metrica, periodo, detalle;
