-- Fase 8 · D-HOY-1 · Inventario de portadas por host (PLAN_FASE8 §9.1-9.2).
--
-- Solo lectura. Cuenta las entradas de biblioteca (`user_media`) y los títulos
-- únicos (`media`) por host de la portada, y dice por dónde se sirve hoy cada
-- host en 2D según `src/lib/images/poster-url.ts` (posterLoader):
--   directo      → el navegador la pide al CDN del proveedor (recibe la IP).
--   optimizador  → pasa por `/_next/image` (Vercel la descarga y la guarda en caché).
-- Aparte del 2D, siempre por el optimizador: la galería de la landing
-- (`textureUrl`, src/lib/landing/immersive.ts), AniList en /best
-- (src/lib/best/poster.ts) y las capturas de Steam (SteamSection, `next/image`
-- sin loader). Las imágenes OG (`opengraph-image.tsx`) las descarga el
-- servidor y las mete en la imagen generada.
--
-- Uso: SQL editor de Supabase o `execute_sql` (solo agregados, ninguna fila
-- de usuario). Para G0 interesan las dos coberturas: por entradas y por
-- títulos únicos.

with portadas as (
  select
    m.id,
    lower(substring(m.poster from '^https?://([^/:]+)')) as host
  from public.media m
  where m.poster is not null and m.poster <> ''
),
clasificadas as (
  select
    id,
    host,
    case
      when host = 'image.tmdb.org'                             then 'TMDB'
      when host = 'media.rawg.io'                              then 'RAWG'
      when host = 's4.anilist.co'                              then 'AniList'
      when host = 'covers.openlibrary.org'                     then 'Open Library'
      when host in ('cdn.myanimelist.net', 'myanimelist.net')  then 'MyAnimeList'
      when host = 'books.google.com'
        or host like '%.googleusercontent.com'                 then 'Google Books'
      when host = 'uploads.mangadex.org'                       then 'MangaDex'
      when host = 'comicvine.gamespot.com'
        or host like '%.cbsistatic.com'                        then 'ComicVine'
      when host like '%.steamstatic.com'
        or host = 'shared.akamaihd.net'                        then 'Steam'
      else 'otro'
    end as proveedor,
    case
      when host in ('image.tmdb.org', 'media.rawg.io', 's4.anilist.co',
                    'covers.openlibrary.org', 'cdn.myanimelist.net',
                    'books.google.com')
        or host like '%.googleusercontent.com'                 then 'directo'
      else 'optimizador'
    end as ruta_2d
  from portadas
)
select
  c.proveedor,
  c.host,
  c.ruta_2d,
  count(distinct c.id)  as titulos_unicos,
  count(um.media_id)    as entradas_biblioteca
from clasificadas c
left join public.user_media um on um.media_id = c.id
group by c.proveedor, c.host, c.ruta_2d
order by entradas_biblioteca desc, titulos_unicos desc;
