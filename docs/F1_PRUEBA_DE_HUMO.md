# F1 · Prueba de humo de las cuñas (D2)

`PLAN_ESTRATEGICO.md` §7.3 (F1) · D2 de `04_DECISIONES_Y_RIESGOS.md`. Creado el 2026-11-07.

## Qué es
Dos mini-landings, cada una con una promesa y un CTA de alta:

| Cuña | URL | Promesa (ES) |
|---|---|---|
| Series y películas en español | `/es/series` | «Tus series, episodio a episodio.» |
| Anime y manga en español | `/es/anime` | «Anime y manga, en una app en español.» |

Lenguaje de la landing v2 (`landing.css`), sin WebGL. HTML estático del CDN (`STATIC_CSP_ROUTES`), `noindex` mientras dure la prueba. Textos en `messages/{es,en}.json` → `landing.wedge`. Cada promesa solo cita funciones que ya existen: progreso por temporada, episodio y capítulo (`api/library/progress`); importar de TV Time, Letterboxd, IMDb y MyAnimeList (`api/account/import/external`); exportar (`api/account/export`).

## Enlaces para publicar (UTM por cuña)
Formato: `https://kulturaapp.vercel.app/es/<cuña>?utm_source=<comunidad>&utm_medium=community&utm_campaign=f1_<cuña>`

- `utm_source`: nombre corto de la comunidad, en minúsculas (`r_series`, `discord_animees`…). Uno por comunidad, siempre el mismo.
- Opcional: `utm_content=post1|post2`, para separar los 2 mensajes de cada comunidad.
- Plan de §7.3: 3 comunidades por cuña, 2 mensajes en cada una.

## Cómo viaja la atribución (sin cookies ni almacenamiento)
1. La visita llega a `/es/series?utm_…`.
2. El CTA del servidor apunta a `/es/login?mode=register&wedge=series`. La isla `WedgeCta` le añade los `utm_*` de la URL al montar. Sin JS se conserva la cuña y se pierde la UTM.
3. El login lee `utm_*` y `wedge` (`parseAttribution`, `src/lib/analytics/attribution.ts`).
   - Alta por correo: se guarda en `user_metadata.attribution` (`signUp`).
   - Alta con Google: viaja en la URL del callback.
4. El callback registra `signup_completed` con `props = { channel, utm_*, wedge, provider }` (`src/lib/analytics/signup.ts`).

## Métricas y dónde se miran

| Métrica | Fuente | Fiable |
|---|---|---|
| Visitas por cuña | Vercel → Web Analytics → Pages: `/es/series`, `/es/anime` | sí (páginas vistas) |
| Visitas por cuña y UTM | Web Analytics → UTM Parameters | **no verificado en Hobby** |
| Clics en el CTA | Web Analytics → Events: `cta_click` con `wedge` | **no verificado en Hobby** (los eventos personalizados podrían ser solo de Pro). Respaldo: visitas a `/es/login`, sin desglose por cuña |
| Altas por cuña y UTM | `analytics_events.signup_completed` (consulta 1) | sí (servidor) |
| Altas con 3 títulos en 24 h | `user_media` creados en las 24 h siguientes al alta (consulta 2) | sí (BD) |

Comprobado el 2026-11-07: la API de consulta de Web Analytics (`/v1/query/web-analytics/*`) responde 404 «Web Analytics not found» para el proyecto `kultura`. Las cifras de Vercel se leen en el panel. Víctor: tras la primera visita con UTM, mira si el panel enseña UTM y `cta_click`, y anótalo aquí.

### Consulta 1 · Altas por cuña y fuente
```sql
select props->>'wedge' as cuna,
       coalesce(props->>'utm_source', '(sin utm)') as fuente,
       count(*) as altas
  from public.analytics_events
 where name = 'signup_completed'
   and props ? 'wedge'
   and created_at >= '2026-11-07'
 group by 1, 2
 order by 1, 3 desc;
```

### Consulta 2 · Activación: altas con ≥ 3 títulos en las 24 h siguientes
Se cuenta en `user_media` y no en `library_add`. Las importaciones (TV Time, Letterboxd, IMDb, MyAnimeList…) escriben la biblioteca sin emitir `library_add` (`api/account/import/route.ts:164-175`), y la promesa n.º 2 de las dos cuñas es justo importar. Cada fila de `user_media` es un título distinto del usuario.
```sql
with altas as (
  select user_id, props->>'wedge' as cuna, created_at as alta_en
    from public.analytics_events
   where name = 'signup_completed' and props ? 'wedge' and created_at >= '2026-11-07'
),
titulos as (
  select a.cuna, a.user_id, count(m.user_id) as n
    from altas a
    left join public.user_media m
      on m.user_id = a.user_id
     and m.created_at between a.alta_en and a.alta_en + interval '24 hours'
   group by 1, 2
)
select cuna,
       count(*) as altas,
       count(*) filter (where n >= 3) as activadas_24h,
       round(100.0 * count(*) filter (where n >= 3) / nullif(count(*), 0), 1) as pct
  from titulos
 group by 1
 order by 1;
```

## Criterio (§7.3, sin cambios)
- **Concluyente solo si alguna cuña llega a ≥ 30 altas.** En ese caso gana la que tenga más altas y más activación (3 títulos en 24 h).
  - **Desempate propuesto (pendiente del OK de Víctor; se fija antes de ver datos):** si una cuña gana en altas y la otra en activación, gana la que tenga más altas activadas en número absoluto. Si siguen empatadas, la que tenga más altas.
- **Si ninguna llega a 30, la prueba es no concluyente.** Por D-F1 (`04_DECISIONES` §1f), la cuña es entonces **A (series y películas en español) por evidencia estructural** (§2.2). Las entrevistas (`F1_ENTREVISTAS.md`) pasan a antes de F4 y no reabren la cuña salvo alerta roja.
- Nunca se decide con altas de un dígito. Tampoco se publican cifras de esta prueba en la web.

## Registro de resultados
| Fecha | Cuña | Visitas | Clics CTA | Altas | Activadas 24 h | Nota |
|---|---|---|---|---|---|---|
| | | | | | | |

## Al cerrar F1
- Decisión escrita en `04_DECISIONES_Y_RIESGOS.md`.
- Las dos rutas se retiran o se rehacen con el sistema de F2. Mientras existan, siguen `noindex`.
