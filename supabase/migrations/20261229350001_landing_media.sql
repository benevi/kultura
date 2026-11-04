-- ============================================================
-- Rediseño · Imágenes con profundidad de la landing, renovadas cada semana
--
-- QUÉ HACE (el código funciona antes y después de aplicarla: sin la tabla,
-- `getLandingMedia()` devuelve una lista vacía y la landing usa su respaldo):
--   1. Tabla landing_media: una fila por imagen de la landing de una semana
--      (portada, funciones, pasos, rankings, cierre). La escribe SOLO la tarea
--      semanal de GitHub Actions (.github/workflows/landing-media.yml) con el
--      service role. Cada fila trae la imagen, su mapa de profundidad y lo que
--      necesita el shader: umbral de la capa delantera, foco del encuadre,
--      proporción de la capa delantera y si el efecto «entre capas» es seguro.
--   2. Lectura pública SOLO de las filas activas (anon y authenticated): son
--      portadas públicas del catálogo, sin datos de usuarios.
--   3. Bucket público «landing» de Storage para las imágenes (lectura pública,
--      escritura solo con service role: no hay policy de INSERT/UPDATE).
-- ============================================================

create table if not exists public.landing_media (
  id            uuid primary key default gen_random_uuid(),
  week          date not null,
  slot          text not null check (slot in ('hero','close','feature','step','ranking')),
  position      smallint not null default 0,
  format        text,                       -- anime | movie | tv | game | manga | book | comic
  media_type    text not null,
  external_id   text not null,
  title         text not null,
  year          smallint,
  rating        numeric(3,1),
  image_path    text not null,              -- ruta en el bucket «landing»
  depth_path    text not null,
  width         integer not null,
  height        integer not null,
  threshold     real not null default 0.5,  -- corte de la capa delantera (0-1)
  focus_x       real not null default 0.5,  -- foco del encuadre (0-1)
  focus_y       real not null default 0.4,
  fg_ratio      real not null default 0,    -- parte de la imagen que queda delante
  layered       boolean not null default false, -- ¿se puede poner el nombre entre capas?
  accent        text not null default '#f2f2f0',
  active        boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (week, slot, position)
);

create index if not exists landing_media_active_idx
  on public.landing_media (slot, position) where active;

alter table public.landing_media enable row level security;

drop policy if exists "landing_media: lectura de activas" on public.landing_media;
create policy "landing_media: lectura de activas"
  on public.landing_media for select
  to anon, authenticated
  using (active);

-- Bucket público (solo lectura sin service role).
insert into storage.buckets (id, name, public)
values ('landing', 'landing', true)
on conflict (id) do update set public = true;
