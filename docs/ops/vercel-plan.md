# Vercel: plan, cuotas y gasto (fase 8 · H9)

Estado a 16-11-2026. Plan: `docs/PLAN_FASE8.md` §10 (coste ≈ 0) y `docs/fase8/8A.0.md`, tarea 13.

## Plan

- Proyecto `kultura` en el equipo personal «benevi's projects», plan **Hobby**: lo dice el panel de Vercel en la captura del 16-11-2026.
- Hobby es gratuito y de uso no comercial. KULTURA no tiene actividad económica (`/legal`), así que encaja. **Cobrar algo obliga a pasar a Pro**, además de las licencias de los catálogos (`docs/PLAN_SANEAMIENTO.md`, «Fuera del saneamiento»).
- Hobby no factura excesos: al pasar de lo incluido, Vercel limita o pausa el servicio hasta que se renueva el periodo. Por eso no hay cargo posible, pero sí riesgo de corte.

## Qué consume imágenes hoy

Viene del inventario de `docs/legal/hoy-inventario.md`:
- `/_next/image` con portadas de MangaDex y ComicVine (25 % de los títulos).
- AniList en `/best`.
- Las capturas de Steam en la ficha.
- La galería de la landing, con todas sus portadas.

`minimumCacheTTL` es de 7 días (`next.config.mjs`). Cada combinación de imagen, ancho y calidad cuenta como una transformación la primera vez y luego se sirve de caché.

Las imágenes OG (`opengraph-image.tsx`) son funciones, no Image Optimization.

## Cuotas que hay que vigilar

Las cifras incluidas en Hobby cambian. Se leen en **Vercel → Usage** (periodo actual) y se apuntan aquí con la fecha:

| Métrica (Usage) | Incluido en Hobby | Uso del periodo | Fecha |
|---|---|---|---|
| Image Optimization: transformaciones | | | |
| Image Optimization: lecturas de caché | | | |
| Image Optimization: escrituras de caché | | | |
| Function invocations | | | |
| Fast Data Transfer | | | |

Regla de la fase 8: si una métrica pasa del **70 %** de lo incluido en un periodo, se revisa antes de añadir hosts o usos del optimizador. §9.5 ya prohíbe ampliarlos en 8A.

## Alerta de gasto (D8)

- La tarea pedía una alerta de 50 $ en **Spend Management**. Spend Management es para equipos de pago (Pro), así que **en Hobby no se puede configurar ni hace falta**: no hay cargo posible.
- Si algún día se pasa a Pro, se configura en ese momento: Settings → Billing → Spend Management, aviso a 50 $ y, si se quiere, pausa de proyectos al llegar.
- Mientras sea Hobby, lo que protege es la tabla de arriba, revisada cada mes junto a la medición `f8-mant`.
