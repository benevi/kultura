# HANDOVER — última sesión (2026-11-06)

**Fase:** F0 (`PLAN_ESTRATEGICO.md` §7.3). **Rama:** `feat/f0-portada-sin-rankings` (PR abierto, sin merge).

## Hecho en esta sesión
- Entregable: **credibilidad inmediata de la portada**, el último punto de Claude en F0. Víctor elige **retirar el bloque de rankings hasta v2.0** (`04_DECISIONES` D-R1), entre 3 opciones: retirar, tarjetas sin nota o un suelo de 2.000 votos.
- Datos de la decisión: votos del proveedor (TMDB y AniList), consultados el 2026-11-06. Series 2026: con un suelo de 1.000 votos el líder sigue siendo «Así aprenderás» (9,4, 1.012 votos); con 2.000 no queda ninguna. RAWG respondía 522, así que juegos quedó sin medir. En `kultura-test`, `landing_media` está vacía y `user_media` solo tiene 3 notas, así que los votos propios no sirven.
- Fuera la sección `#rankings`, su enlace del menú, su CSS y las claves `landing.rankings.*` y `landing.nav.rankings` (es/en).
- Se quedan `scenes.ranking` y el hueco `ranking` de `build.py`, porque la tarea semanal lo exige para activar una semana.
- Capturas en `docs/capturas/f0-portada-sin-rankings/`: 390 y 1440, animada, reduced-motion y sin WebGL. Consola sin errores propios; el 404 de `_vercel/insights` solo sale en local.

## Verificación
- `tsc` y `next lint` limpios. `vitest` en Windows: los mismos 16 fallos conocidos y ninguno nuevo.
- Lighthouse local en `/es` (build nuevo, `next start`): JS 149,8 KB (≤ 150 KB, justo, como ya estaba), CLS 0. El cambio no añade JS de cliente. La comparación buena es la del job de CI.
- Revisión independiente: ver `04_DECISIONES` §4. CI (`cuj`, Lighthouse, axe): ver el PR.

## Pendiente / ojo
- Con esto se cierra la parte de Claude en F0. Lo que queda es de Víctor: Analytics con un evento de prueba, el dominio (D3), el simulacro de restauración y R9 (el historial de migraciones de producción).
- Para v2.0 o F3-9: `/best` mantiene su suelo relajado del año en curso (series 300 → 75), y el líder de series es poco creíble también allí.
- `build.py` sigue procesando 4 imágenes de ranking cada semana que ya no se pintan. Revisarlo cuando Inicio v2 decida si vuelven.
- Había un `next start` viejo escuchando en el puerto 3187 (sirve la portada con rankings). No se tocó. Para medir en local se usó el 3191.
- R9: no ejecutar `supabase db push` contra producción.
- Squash-merge: solo con OK de Víctor.
