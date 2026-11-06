# KULTURA — Decisiones y riesgos

Registro de las decisiones de Víctor sobre `docs/PLAN_ESTRATEGICO.md` §12 y de los riesgos que crean. Este documento manda sobre cualquier handover anterior en lo que se contradiga. Riesgos generales del plan: `PLAN_ESTRATEGICO.md` §10 (no se duplican aquí).

## 1. Decisiones de §12 (respondidas el 2026-11-06)

| # | Pregunta | Respuesta | Consecuencia |
|---|---|---|---|
| D1 | Estrategia | **Opción A**: refundar sobre los cimientos actuales | UI nueva en `src/v2/` tras el interruptor `ui_v2`; la UI vieja solo se borra cuando la nueva sirve el 100 % y existe la etiqueta `v1-ui` (Anexo B). |
| D2 | Cuña principal | **Validar ambas en F1** (series y películas ES / anime y manga ES) | Entrevistas + prueba de humo `/es/series` y `/es/anime` con UTM. Concluyente solo con ≥ 30 altas en alguna cuña; si no, deciden la evidencia estructural (§2.2) y las entrevistas. |
| D3 | Dominio | **Aún no se compra** | Se sigue en `*.vercel.app`. Sin 308, sin `NEXT_PUBLIC_SITE_URL` nuevo, sin Search Console con dominio propio. Ver R1. |
| D4 | Sostenibilidad | **Sí**: página «Manifiesto / Cómo se sostiene» fuera de la landing **y** consulta escrita a TMDB y ComicVine sobre donaciones | El Manifiesto entra en el flujo 12 de v2.0 (Legal + Manifiesto). Donaciones bloqueadas hasta respuesta escrita (R4). |
| D5 | Horas y alcance | **20 h/semana · alcance completo (12–13 flujos)** | Relanzamiento estimado **febrero–abril 2027** (§7.1). Ver R2. |
| D6 | Partida para identidad humana | **Decidir entonces** (si F2 falla la rúbrica en 3 rondas) | La salida de emergencia de §6.1 queda sin financiar hasta esa fecha. Ver R3. |
| D7 | Proceso de prototipos | **Acepta**: style tiles y 1.ª pantalla en HTML; desde la 2.ª, directamente en rama `v2/<pantalla>` sobre preview de Vercel | Sustituye la regla del 4/11. Nada llega a producción sin un «sí» escrito de Víctor. |
| D8 | Fuente de verdad | **Sí**: proyecto nuevo «KULTURA 2.0» en claude.ai + `docs/` del repo como fuente única | El proyecto de claude.ai enlaza a `docs/`, no duplica. Los 74 handovers se archivan. |

## 1b. Decisiones del inventario `FUNCIONES_V2.md` (2026-11-06)

| # | Duda | Decisión | Evidencia / consecuencia |
|---|---|---|---|
| D-I1 | `/friends` no está en el Anexo A, pero perfil, «Popular en tu círculo» y Recomendar dependen de amistades | **Pantalla mínima dentro de F3-7**: amigos, solicitudes, buscar usuario | Bloqueos (`/api/friends/blocks`) y chat siguen en v2.1. F3-7 crece: revisar horas al planificarlo. |
| D-I2 | ¿«Popular en tu círculo» y «Noticias por género» en Inicio v2.0? | **Lo decide el brief de Inicio en F2** | `(app)/home/page.tsx:197-198`. Quedan como candidatos, no compromisos. |
| D-I3 | `/suggestions` (buzón a KULTURA, no «sugerencias a amigos») | **Transversal v2.0** | Enlazado en `layout/AppFooter.tsx:37` y `AvatarDropdown.tsx:60`; canal de feedback para F4/F5. |
| D-I4 | `/email/confirm` | **Aparcado v2.1**, sigue funcionando con la UI vieja | Es el doble opt-in del correo semanal (`email/confirm/page.tsx:2`). No se borra. |
| D-I5 | `/report` | **Transversal v2.0, obligatorio** | Denuncia sin cuenta, DSA art. 16 (`report/page.tsx:2`, `api/reports/public/route.ts:3`). Resuelta con el código, sin pregunta. |

## 2. Riesgos derivados de estas respuestas

| ID | Riesgo | Origen | Impacto | Mitigación / disparador |
|---|---|---|---|---|
| R1 | La puerta de salida de F0 exige «dominio principal con 308 y Search Console»: **F0 no puede cerrarse completa** sin dominio. Cada mes sin dominio es antigüedad perdida para el SEO de F4. | D3 | alto en F4 | Cerrar F0 «salvo dominio» y dejarlo como bloqueo explícito. Reabrir la decisión antes de F4 como muy tarde; idealmente antes de la prueba de humo de F1 (las UTM y las landings de cuña quedarían en `vercel.app`). |
| R2 | 20 h/semana es la fila más optimista de §7.1 y el plan marca «jornada completa y cambio de puesto» como riesgo de prob. alta. Si las horas reales bajan, la fecha cae a marzo–julio (12 h) o junio–noviembre 2027 (8 h). | D5 | alto | Revisar horas reales cada 2 semanas. Si la media cae por debajo de 15 h dos revisiones seguidas, pasar a alcance mínimo (8 flujos) o mover la fecha; nunca mantener la fecha sin horas detrás. |
| R3 | Sin partida, no hay salida si F2 no pasa la rúbrica en 3 rondas: riesgo de repetir el bucle de prototipos rechazados del 3–4/11. | D6 | alto en F2 | Decidir la partida al cerrar la 3.ª ronda fallida, no después. Pedir presupuestos orientativos en paralelo a la 2.ª ronda para que la decisión no retrase F2. |
| R4 | El Manifiesto puede prometer «enlace de apoyo» antes de tener permiso de TMDB y ComicVine (TMDB: donaciones «zona gris»; ComicVine: «estrictamente no comercial»). | D4 | alto (licencias) | El Manifiesto no lleva enlace de apoyo hasta tener respuesta escrita. Si ComicVine dice no, evaluar sustituto antes de activar donaciones. |
| R5 | `CLAUDE.md` exige leer `docs/NOW.md` y `docs/BACKLOG.md` antes de escribir código, y cerrar tareas en `docs/DONE.md`; **ninguno de los tres existe** en el repo. El flujo de trabajo de una tarea a la vez no tiene ancla. | proceso | medio | Crearlos (o adaptar `CLAUDE.md` a §8 del plan) en una tarea de F0 propia. No se mezcla con el inventario. |
| R6 | La rama `feat/login-el-hueco` (commit `225a9be`) adelanta el paso 1 de F3 (Entrar/Crear cuenta) antes de que existan el interruptor (F0) y la identidad (F2). Sus cambios sin commit se descartaron el 2026-11-06. | proceso | medio | Queda aparcada, sin merge a `master`. Se revisa al llegar a F3 paso 1; puede servir de referencia, no de base. |
| R7 | D8 depende de que Víctor cree el proyecto «KULTURA 2.0» en claude.ai: hasta entonces conviven dos fuentes (el proyecto viejo y `docs/`). | D8 | medio (context rot) | Mientras tanto, `docs/` manda; cualquier contradicción con el proyecto viejo se resuelve a favor del repo. |

## 3. Pendiente de Víctor (paneles, solo tú)

- Crear el proyecto «KULTURA 2.0» en claude.ai (D8).
- Consulta escrita a TMDB y ComicVine sobre donaciones (D4).
- Dominio: reabrir la decisión antes de F1/F4 (D3, R1).
- Resto de paneles de F0 en `PLAN_ESTRATEGICO.md` §7.3 (Web Analytics, `kultura-test`, custodia de la clave `age`).
