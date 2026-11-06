# KULTURA — Plan estratégico de refundación (v1.1 · 5/11/2026)

**Para quién:** Víctor decide; cualquier sesión de Claude ejecuta. Este documento manda sobre los handovers anteriores en todo lo que se contradiga.
**Evidencia:** `claude/auditoria/CIMIENTOS_CODIGO.md` (auditoría del repo `benevi/kultura` en `28479c1`, solo lectura, cifras de `wc`/`grep`), `claude/auditoria/MERCADO_2026.md` (91 fuentes con URL y fecha), consultas directas a Vercel y Supabase (5/11/2026), comprobación independiente de los tres hechos de mercado que más pesan (Anexo C) y **una revisión independiente de este plan por un agente escéptico sin contexto previo** (24 observaciones; las 6 graves están corregidas en esta versión; registro en Anexo D). Lo no verificado se marca **(no verificado)**.

---

## 0. Resumen (12 puntos)

1. **No hay medición fiable.** La API de Vercel responde `Web Analytics not found` para el proyecto y `analytics_events` tiene 0 filas. «Cero visitas» es hoy una sensación, no un dato. Lo que sí es dato: **7 cuentas en 7 meses y solo 1 externa** (14/6/2026, 0 títulos, no volvió). Las otras 6 son tuyas, la demo y sus 3 semillas.
2. **El producto está mucho más construido de lo que parece**: 69.636 líneas en `src`, 37 páginas, 51 rutas de API, 35 tablas con 151 políticas RLS, 1.754 textos ES/EN con paridad 100 %, 3.749 casos de test, CI con accesibilidad y presupuesto de rendimiento. Las tablas de las últimas oleadas del PLAN_MAESTRO_360 (`blocks`, `user_media_logs`, `username_history`, `user_streaming_services`, `analytics_events`, `ai_recs`, `email_*`) existen en producción. Los cimientos son de calidad alta.
3. **El diseño no es «plantilla» en los tokens** (fuentes, iconos, sombras y voz propios) **pero sí en la composición**: tarjetas redondeadas en rejilla (99 `rounded-2xl` + 97 `rounded-bento` + 181 `rounded-full`), 21 esqueletos `animate-pulse`, cabecera estándar, landing con estructura SaaS. Eso es lo que se lee como «una más».
4. **Mercado:** nadie ha ganado en multi-formato; ganan los especialistas con comunidad (Letterboxd > 30 M, StoryGraph 5 M, Backloggd, Serializd). KULTURA es una **combinación nueva** (7 formatos + español + web gratuita + social + PWA), no una invención. Ninguna función aislada es inédita.
5. **Hay un hueco estructural en España:** FilmAffinity (28,6 M visitas/mes, 65 % España) **no lleva episodios ni exporta**; Serializd (inglés) tiene a España como 2.º país (7,7 %); Trakt está en inglés y recortó el plan gratis en 2025; TV Time (gratis, en español, 26,4 M instalaciones globales) **cerró el 15/7/2026**. No existe nada gratis + español + episodios + social + exportable. TV Time es la prueba de que la demanda existe y el relato para el SEO, **no** un embudo: su ventana de exportación cerró el 15/7 y quien quiso migrar lo hizo en julio (JustWatch, Simkl y otros lanzaron importadores entonces).
6. **Reescribir de cero costaría 120–200 días efectivos para volver a donde estás**; sustituir la capa visual sobre los cimientos, **30–50 días efectivos** (unas 240–400 h) para las 37 páginas. Decisión recomendada: **refundar sobre cimientos**, sin reutilizar componentes de la UI vieja, y relanzar con **menos pantallas y más carácter**.
7. **Las horas mandan.** A 8–12 h/semana, «marzo de 2027» era una fantasía: con el alcance v2.0 completo (12–13 flujos, 25–35 pantallas reales) el relanzamiento cae entre **marzo y julio de 2027** según las horas; con el alcance mínimo (8 flujos), entre **febrero y mayo**. La tabla de §7.1 lo fija; tú eliges la fila.
8. **El rediseño no trae visitas.** Las visitas vienen de dominio propio, un posicionamiento en un hueco, importadores convertidos en páginas de captación, comunidades hispanas y vídeo del propio diseño en redes. El diseño decide si quien llega se queda (y, en redes, si una captura detiene el scroll).
9. **Los 10+ prototipos rechazados el 3–4/11 no fallaron por capacidad sino por falta de brief:** no hay un documento que diga qué significa «como kprverse» en términos operativos, qué NO puede aparecer ni con qué criterio se evalúa. Antes de dibujar: plataforma de marca + brief + rúbrica + tope de rondas.
10. **Nada se borra hasta que la UI nueva sirve el 100 % del tráfico.** Antes: inventario del alcance v2.0, tests de recorridos críticos contra una base de datos real, rescate de la lógica atrapada en la UI y etiqueta `v1-ui` en git (git ya es la memoria completa; el inventario es el índice).
11. **Sostenibilidad:** el stack solo es legal **sin anuncios ni servicios de pago**: TMDB (no comercial; donaciones «zona gris»), ComicVine (estrictamente no comercial), MangaDex (sin anuncios ni pago; donaciones permitidas), RAWG (gratis con enlace de vuelta; comercial permitido por debajo de 100 K usuarios/mes). TV Time murió del modelo «gratis sin plan». Hay que tener respuesta pública a «¿cuánto durará esto?» aunque la portada no hable de dinero.
12. **Higiene de contexto:** la fuente de verdad pasa al repo (`docs/`), el proyecto de claude.ai se reduce a constitución + handover + auditorías, los 74 handovers se archivan y se crea `CLAUDE.md` (hoy no existe en el repo).

---

## 1. Diagnóstico

### 1.1 Datos reales (consultados el 5/11/2026)

| Métrica | Valor | Fuente |
|---|---|---|
| Vercel Web Analytics | la API responde 404 `Web Analytics not found` → no activado **(confirmar en el panel)** | API Vercel, proyecto `kultura` |
| `analytics_events` | 0 filas (compatible con «no hubo actividad real» y con un fallo silencioso: `track()` es fail-open) | Supabase `app movies` |
| Cuentas | 7: `benevi`, `victor_franco` (tú), `kultura_demo` + `lucia_lee`, `marcos_play`, `irene_pages` (semillas 8/10), `gsuve24` (externa, 14/6/2026, 0 títulos, último acceso el mismo día) | `auth.users` + `public.users` |
| Actividad últimos 7 días | 1 cuenta (la demo) | `last_sign_in_at` |
| Contenido | 123 ítems, 95 títulos cacheados, 5 listas, 3 amistades, 5 mensajes, 1.925 adaptaciones (Wikidata), 102 traducciones | Supabase |
| Producción | `/es` 200 en 0,5 s, 85 KB de HTML, landing v2 con 14 imágenes | `curl` |
| Proyecto Supabase de test `kultura-test` | **INACTIVO (pausado)** | API Supabase |
| Search Console / Bing | **estado desconocido** | — |
| Dominio | `kulturaapp.vercel.app`; sin dominio propio desde abril (decisión D-18 del 22/10 sin ejecutar) | Vercel |
| Dominios libres a 5/11 | `kulturaapp.es`, `kulturaapp.app`, `kulturaapp.io`, `kultura.watch` (ocupados: `kulturaapp.com`, `kultura.app`, `kultura.es`) | Registro de Vercel |

### 1.2 Por qué nadie llega (causas por peso)

1. **Sin dominio ni autoridad.** Un subdominio `vercel.app` no posiciona ni inspira confianza. «Kultura» es palabra común en polaco, euskera, filipino y otras lenguas: la búsqueda de marca es imposible sin apellido («kultura app»).
2. **Sin posicionamiento.** «Todo lo que ves, lees y juegas» compite contra todos y no gana ninguna búsqueda ni ninguna comunidad.
3. **Distribución casi nula.** Redes creadas el 21/10, dos semanas de publicaciones automatizadas, pausadas el 3/11. Sin comunidades, sin prensa, sin importadores publicitados, sin tiendas de apps, sin boca a boca.
4. **Sin medición**, luego sin aprendizaje.
5. **El diseño** afecta a la conversión de quien llega y a la retención, no a la llegada. Excepción real: en redes una captura genérica no detiene el scroll; ahí el diseño sí capta.

Conclusión: el rediseño es **necesario** (tienes razón en que debe tener carácter) pero **insuficiente**. Relanzar solo con diseño nuevo y sin §5 y §7 dará el mismo resultado.

### 1.3 Qué está bien y qué está mal (síntesis de la auditoría de código)

| | Veredicto | Evidencia |
|---|---|---|
| Capa de datos y proveedores (`src/lib/api`, 56 archivos) | **CONSERVAR** | `providerFetch` con plazos, reintentos solo 5xx, Zod, circuit breaker, caché solo de respuestas válidas, cupos en Upstash, adaptador por familia (ADR 0001), 12 tests de contrato semanales |
| Esquema Supabase (31 migraciones, 6.141 líneas SQL) | **CONSERVAR (ejemplar)** | 35 tablas, 151 políticas, 52 funciones `SECURITY DEFINER` todas con `search_path`, `demo_no_*` reaplicadas en 11 migraciones, `rls_audit()`. Pendiente: comprobar que `supabase db reset` reproduce el esquema (no verificado) |
| Auth, CSP, rate-limit, redirecciones seguras | **CONSERVAR** | nonce por petición, CSP fija en rutas CDN, 45 de 51 rutas con límite, `env.server.ts` con Zod |
| i18n (1.754 claves, 46 espacios) | **CONSERVAR** | paridad exacta, 6 tests |
| Tests de lógica (`tests/unit/**/*.test.ts`, 241 archivos) | **CONSERVAR con matices** | 36 importan `@/components` o `@/app` (12 de ellos lógica de UI: `rating-share`, `tonight`, `in-app-browser`, `engine`…) y 13 de `tests/unit/design|visual` están atados a `DISENO.md` y a los tokens: se rompen al cambiar el primer token. Van a la lista del PR de rescate |
| Tests de componentes (119 `.tsx`, 2 snapshots de 531 KB) | **RETIRAR al final** | se pierden con la UI vieja |
| IA con coste acotado | **CONSERVAR** | tope diario atómico, 1 llamada/usuario/día, candidatos solo del catálogo |
| Operaciones (CI, backups cifrados, contrato, Sentry, health, cron) | **CONSERVAR** | 4 workflows, Lighthouse CI (150 KB JS, CLS 0,05) |
| Capa visual (`src/components/*` salvo `landing`, `icons`, `Logo`; páginas y clientes) | **SUSTITUIR** | composición genérica; 21 archivos > 300 líneas que mezclan estado, fetch y UI |
| Lógica atrapada en la UI (1.012 líneas de `.ts` bajo `app/[locale]` + flujos de `LoginPage` 869, `SettingsForm` 1.019) | **RESCATAR antes** | `rating-share.ts` (HMAC), `platforms.ts`, `tonight.ts`, `starter-titles.ts`, cooldown y atribución del login |
| Deuda | **LIMPIAR solo lo que sobrevive** | en `lib`/`api`: `isNotMigrated` ×3, tolerancia a migraciones ya aplicadas, `server-only` en `admin.ts`; `three` y Geist sin uso. Lo que vive en la UI vieja no se limpia: se va con ella |
| Lo que SÍ tiene carácter (semilla) | **CONSERVAR** | landing v2 (`engine.ts` WebGL sin dependencias, chaflán 18 px, `KulturaDisplay` 17 KB, pipeline semanal de imágenes), sombras duras y «pegatina», grano, logo de 3 rectángulos, 42 iconos propios, `VOZ.md` con tests |

### 1.4 Por qué fracasó el rediseño del 3–4/11

- **Sin brief.** `DESIGN_REFERENCIAS.md` describe las referencias, pero nadie tradujo «como kprverse» a reglas: qué se toma (escena a sangre, titular gigante, chaflán, mantener pulsado, UI mínima), qué se descarta (fondo blanco, mono de 8 px, retículas) y qué significa «profundidad» en una biblioteca con 200 portadas.
- **Sin criterio de evaluación.** Cada propuesta se juzgó con «me gusta / no se parece». Sin rúbrica, el generador optimiza al azar y el revisor se agota.
- **Sin material propio.** Los modelos 3D con IA (Meshy, Tripo) no tenían presupuesto ni pipeline; lo que funcionó (landing v2) fue usar **portadas reales partidas en capas**. El material de KULTURA son las portadas.
- **Demasiadas pantallas en paralelo** y un lienzo (Claude Design) que no renderiza 3D ni animación real.
- **Contexto saturado:** 74 handovers y decisiones contradictorias (DISENO.md viejo frente a reglas nuevas).

---

## 2. Mercado (síntesis; detalle y fuentes en `MERCADO_2026.md`)

### 2.1 Competidores que importan

| Segmento | Quién | Lo que KULTURA no puede igualar | Lo que les falta (hueco) |
|---|---|---|---|
| Cine | Letterboxd (> 30 M miembros; en venta) | comunidad, marca, TikTok | sin series; import CSV solo Pro; inglés |
| Cine+series | Trakt (~8 M visitas/mes) | ecosistema de apps, scrobbling | inglés; plan gratis recortado en 2025 (100 ítems; 250 desde 2026, Anexo C); rediseño nov-2025 mal recibido |
| Cine+series ES | **FilmAffinity** (28,6 M visitas/mes, 65 % España) | catálogo, notas, autoridad en España | **sin episodios, sin exportación**, UI antigua |
| Series social | TV Time | — (**cerró el 15/7/2026**) | demostró demanda de gratis+español+social; la migración ya ocurrió en julio |
| Multi-vídeo | Simkl (~4 M visitas/mes) | importadores de 20 servicios, scrobbling | sin libros, juegos ni cómics; interfaz recargada; colaboración solo VIP |
| Anime/manga | MAL (vendida a Gaudiy/Web3 2025), AniList (inglés, API a 30 req/min), Kitsu (parada) | tamaño | español, diseño, estabilidad |
| Juegos | Backloggd (~9,3 M visitas/mes, España 3,4 %) | comunidad | **sin app, sin import Steam/CSV**, inglés |
| Libros | Goodreads, StoryGraph (5 M), Hardcover (59 K) | catálogo, importador Goodreads | sin español verificado |
| Multi-formato real | Sofa, Sequel, OnTrack, allist (iOS); Ryot, Yamtrack (autoalojado); Achriom (9,99 $/mes) | — | **solo iOS, o sin móvil, o de pago**; ninguno con social público + web gratis |

### 2.2 Huecos con evidencia (no deseos)
1. **Series en español con episodios y exportación** (estructural): FilmAffinity domina y no lo hace; Serializd lo hace en inglés y aun así España es su 2.º mercado.
2. Expulsados de Trakt (2025–2026) e **importador de FilmAffinity**: no existe ninguno oficial; el informe lo califica de único en España.
3. Juegos: Backloggd sin app ni importación.
4. Cómic + manga juntos: no existe en ningún tracker consumer (nicho).
5. Portabilidad total gratis: rara (Letterboxd Pro, Simkl VIP, Backloggd nada). «Tus datos son tuyos» es argumento de venta demostrado tras TV Time.

### 2.3 Lo que NO es hueco
Importar de Letterboxd/MAL/Goodreads, «dónde verlo», resumen anual, recomendaciones con IA: todos existen. La IA además es un riesgo reputacional (Fable retiró toda su IA en ene-2025).

### 2.4 Lecciones de crecimiento verificadas
Letterboxd: 1,8 M (2020) → > 30 M (2026) con TikTok, «Four Favorites» y «Year in Review». StoryGraph: importador de Goodreads + momentos de indignación con Amazon. Simkl: páginas «Simkl vs X» indexadas + importadores de un clic. Hardcover: un post técnico con 60 K vistas **no trajo casi usuarios**; atribuye el crecimiento a Wrapped y a la comunidad. Backloggd: una persona, Patreon desde 1 $/mes, roadmap público. Patrón de abandono documentado: muchos registros la primera semana → abandono; sobreviven los que tienen comunidad o importación automática.

---

## 3. ¿Aporta KULTURA algo? Veredicto

- **Función a función: nada nuevo.**
- **Como combinación: sí, defendible con evidencia.** No se ha encontrado ningún producto consumer que reúna 7 formatos (incluidos manga y cómic) + español nativo + web gratuita sin plan de pago + social con perfil público + PWA + exportación completa gratis.
- **Como invención: no.** Y «gratis sin plan de pago» es a la vez la mayor diferencia y la mayor **debilidad** percibida.

**Implicación:** la ventaja no es «hace todo», es **«hace lo que a ti te falta, en tu idioma, sin encerrarte»**. El multi-formato se conserva como arquitectura (ya está hecho) pero **no se vende como promesa principal**: se vende una cuña (§5) y el resto «viene de regalo».

---

## 4. Mantener lo que hay vs. empezar de cero

| Opción | Esfuerzo | Pros | Contras | Veredicto |
|---|---|---|---|---|
| **A. Refundar sobre cimientos**: sustituir la UI entera, conservar `lib`, APIs, Supabase, i18n, tests de lógica, CI | **30–50 días efectivos** (auditoría; 37 páginas) | identidad nueva sin perder 7 meses de endurecimiento; `messages/` reutilizable al 100 %; CI y RLS siguen protegiendo | resistir la tentación de reutilizar componentes viejos; rehacer tests de UI | **RECOMENDADA** |
| B. Reescribir UI + APIs, conservar solo Supabase y `lib` | 55–90 días (auditoría) | «más limpio» en apariencia | se reintroducen fallos ya corregidos; las APIs no son diseño | No |
| C. Todo de cero | 120–200 días para paridad (auditoría) | libertad total | se pierden 6.141 líneas de SQL endurecido, 41.366 de tests, textos, legal, importadores, backups… | **Solo si cambias de producto o de stack** |
| D. Segunda app «visual» sobre el mismo Supabase | estimación propia, no auditada: ≥ B | la vieja sigue viva | duplicar middleware, CSP, auth, cuotas; el interruptor por ruta (§7.4) lo consigue dentro del repo | No |

**Matiz para tu idea de «borrar todo lo relativo al diseño»:** sí, pero en este orden: (1) inventario del alcance v2.0 escrito desde el código, (2) tests de recorridos críticos contra una base de datos real que pasen con la UI actual, (3) rescate de la lógica atrapada en la UI, (4) construcción tras interruptor, (5) **borrado solo cuando la UI nueva sirve el 100 %**, con etiqueta `v1-ui` en git. Borrar primero y recordar después es la fuente de pérdidas que quieres evitar.

---

## 5. Estrategia de producto

### 5.1 Posicionamiento (propuesta)
- **Para quién:** personas en España (y después Hispanoamérica) que llevan al día lo que ven y a las que FilmAffinity no les da episodios ni exportación, Trakt les habla en inglés y TV Time les dejó sin app.
- **Promesa principal (cuña):** *«Lleva tus series y películas al día, en español, con tu gente, y con tus datos siempre tuyos.»* Anime, manga, juegos, libros y cómics aparecen como «y también», no como titular. (Frase definitiva: en el brief, §6.)
- **Por qué esta cuña:** es el único hueco **estructural y grande** (28,6 M visitas/mes de FilmAffinity sin episodios ni exportación; Serializd con España como 2.º país) **ya cubierto por funciones que existen** (progreso por episodio, calendario, dónde verlo, importadores, exportación). TV Time y Trakt son el relato («por qué ahora») y contenido SEO, no el embudo.
- **Cuña secundaria (a validar en paralelo):** anime + manga en español. Coincide con tu gusto visual (KPR es lenguaje de manga), con comunidades activas (Discord de anime y manga en español, 18,8 K miembros) y con incumbentes débiles. Riesgo: la API de AniList está degradada a 30 req/min.
- **Decisión:** F1 compara ambas con datos (§7.3). Si la prueba no es concluyente, decide la evidencia estructural + las entrevistas, y se registra en `04_DECISIONES`.

### 5.2 Principios de producto para la v2.0
1. **Menos pantallas, más carácter.** v2.0 relanza con 12–13 **flujos** (25–35 pantallas reales; el inventario de F0 da la cifra exacta) o con 8 (alcance mínimo). Chat, grupos, calendario, notificaciones, sugerencias, correo semanal y push **no se relanzan en v2.0**: su UI vieja se conserva en el repo sin servirse y **se rehace en v2.1** (estimación propia, no auditada: 8–15 días efectivos). Los datos no se tocan.
2. **Una cosa mejor que nadie** (series al día en español) antes que siete regular.
3. **Las portadas son el material.** Nada de ilustración genérica ni 3D de stock.
4. **Tus datos son tuyos**: exportación completa, gratuita y visible; importadores como puertas de entrada.
5. **Público solo lo que el usuario elige**; perfiles y listas compartibles son el bucle de crecimiento.
6. **Rankings creíbles**: suelo de votos y filtros (hoy la portada muestra una «serie» a 9,4 y una película a 9,1 que un visitante no reconoce).
7. **Móvil primero, 3D después.** El 3D y la animación son capa opcional: la página debe existir sin WebGL, con `prefers-reduced-motion` y en gama baja, dentro de 150 KB de JS inicial.
8. **Sin IA en la portada.**
9. **Oscuro como identidad; accesibilidad sin modo claro:** v2.0 no honra `prefers-color-scheme` (decisión consciente, registrada) pero el sistema de tokens debe permitir un **tema de alto contraste** (`prefers-contrast: more`) en v2.1.

### 5.3 Sostenibilidad y confianza (decisión tuya)
- Licencias: MangaDex permite donaciones y prohíbe anuncios y servicios de pago; RAWG gratis con enlace de vuelta (comercial solo por debajo de 100 K usuarios/mes); TMDB exige uso no comercial y considera las donaciones «zona gris»; ComicVine es «estrictamente no comercial» y no menciona donaciones. **Antes de activar donaciones: confirmar por escrito con TMDB y ComicVine** (o aceptar sustituir ComicVine).
- Propuesta que respeta tu regla de «no hablar de dinero en la web»: una página **«Manifiesto / Cómo se sostiene»** fuera de la landing: datos exportables siempre, sin anuncios, costes públicos, roadmap público y, cuando quieras, enlace de apoyo.

### 5.4 Costes (lo que cuesta mantener y relanzar)
| Partida | Coste | Nota |
|---|---|---|
| Dominio `.es` | ~10–15 €/año **(no verificado: la API de precios falló; comprobar al comprar)** | única compra imprescindible |
| Vercel Hobby | 0 € | **solo uso no comercial**; vigilar CPU y 5.000 transformaciones de imagen/mes |
| Supabase Free | 0 € | **se pausa tras 7 días sin actividad** (`kultura-test` ya está pausado); el cron diario mantiene viva producción; sin backups nativos → los del repo |
| Upstash, Resend, Sentry, UptimeRobot | 0 € | planes gratuitos ya previstos |
| Anthropic (IA) | ≤ 10 $/mes | tope en código + límite en consola |
| Google Play (TWA, v2.1) | 25 $ únicos | iOS (99 $/año): no |
| Identidad por encargo (si F2 no pasa la rúbrica) | **a decidir**: orientativo 300–800 € para logotipo y dirección por una persona freelance **(no verificado)** | sin esta partida la «salida de emergencia» de §6.1 no existe |

---

## 6. Diseño: cómo se hace esta vez

### 6.1 Proceso en 7 pasos con puerta en cada uno
| Paso | Entregable | Puerta |
|---|---|---|
| 1. Plataforma de marca | `02_DISEÑO_BRIEF.md` §A: a quién hablamos, personalidad (3 adjetivos y 3 anti-adjetivos), tono (`VOZ.md`), promesa | Víctor, por escrito |
| 2. Referencias → reglas | §B: de cada referencia (KPR, Immersive Garden, Dropbox Brand, Rijksmuseum, Bruno Simon + las que aportes), qué se toma y qué se descarta, en frases operativas («titular ≥ 96 px, tracking −6 %», «una interacción firma por pantalla», «UI secundaria en mono ≥ 11 px») | Víctor |
| 3. Anti-lista y rúbrica | §6.2 y §6.3 | Víctor |
| 4. Tres **style tiles** estáticos (logotipo, paleta, tipografía, forma, un fragmento de pantalla) | 3 páginas HTML probadas a 390 y 1440 | rúbrica ≥ 4/5 en los criterios 1–4 y tu «sí» a UNA |
| 5. Sistema de diseño | `03_DESIGN_SYSTEM.md` = nuevo `DISENO.md`: tokens, tipografía, motion, profundidad, componentes base, presupuesto, a11y; decide qué pasa con los 13 tests `design|visual` atados al sistema viejo | revisión independiente (Artisan + Advocate) + Víctor |
| 6. Prototipo vivo de UNA pantalla (Inicio con sesión) | HTML publicado como artifact, con portadas reales, probado en navegador (390/1440, sin WebGL, reduced-motion) **antes** de enseñártelo | rúbrica completa + Víctor |
| 7. Resto de pantallas | **directamente en la rama `v2` sobre una preview de Vercel**: el mismo artefacto es prototipo y PR (evita implementar dos veces y mide Lighthouse desde el principio). Nada llega a producción sin tu «sí» | §8.5 |

Regla de iteración: máximo **3 alternativas por paso**; no hay nueva ronda sin **feedback escrito contra el brief** («falla el criterio 2 porque…»). Si tras 3 rondas del paso 4 ninguna propuesta pasa, la salida no es «otra ronda» sino **una persona** para logotipo y dirección (partida de §5.4): Claude produce; el gusto que evita lo genérico es humano (el tuyo como director de arte y, si hace falta, el de un profesional).

### 6.2 Anti-lista (lo que no puede aparecer)
Modo claro · texto denso o etiquetas innecesarias · menciones a dinero en la landing · neón, cristal (`backdrop-blur` decorativo), degradados genéricos · tarjetas redondeadas en rejilla como patrón por defecto · esqueletos `animate-pulse` · hero centrado con dos botones · estructura «features / cómo funciona / FAQ» · emojis en títulos · ilustración o 3D generados sin material propio · iconos de librería · morado/índigo por defecto · micro-copy de SaaS («Empieza gratis», «Potencia tu…») · retículas y crucetas decorativas · composición de la portada repetida en otras pantallas.

### 6.3 Rúbrica (1–5 cada criterio; pasa con media ≥ 4 y ningún 1–2)
1. **Carácter**: ¿se reconoce como KULTURA tapando el logo?
2. **Fidelidad al brief** y a la anti-lista.
3. **Portadas como material**: el contenido real protagoniza.
4. **Legibilidad móvil** a 390 px con una mano; jerarquía clara en 3 segundos.
5. **Profundidad y movimiento con propósito**: una interacción firma por pantalla; curvas y duraciones del sistema.
6. **Funciona sin WebGL ni animación** y cumple 150 KB JS inicial.
7. **Accesibilidad**: contraste ≥ 4,5:1, foco visible, objetivos ≥ 44 px, lectores de pantalla, alto contraste previsto.
8. **Voz**: textos según `VOZ.md`, mínimos.
9. **Coherencia de sistema**: tokens y componentes del `DESIGN_SYSTEM`.
10. **Viabilidad** en Next.js dentro del presupuesto.

### 6.4 Restricciones técnicas como material creativo
Negro `#0a0a0a` · `Bricolage Grotesque` + `KulturaDisplay` autoalojadas · chaflán 14–18 px · curvas `cubic-bezier(.2,0,0,1)` y `(.77,0,.175,1)` · WebGL propio sin dependencias (`engine.ts`) · imágenes con mapas de profundidad del pipeline semanal · presupuesto Lighthouse en CI. Todo esto existe y es tuyo: es la semilla.

---

## 7. Plan por fases

### 7.1 Esfuerzo y calendario en horas reales (la variable eres tú)

Horas estimadas (1 dev + IA; incluye tu tiempo de revisión):

| Bloque | Alcance completo v2.0 (12–13 flujos) | Alcance mínimo (8 flujos) |
|---|---|---|
| F0 medir, asegurar, rescatar | 40–60 h | 35–50 h |
| F1 validar la cuña | 15–25 h (sobre todo tuyas: entrevistas) | igual |
| F2 identidad y dirección de arte | 40–80 h (el cuello de botella son las rondas) | igual |
| F3 construir pantallas + tests | 110–210 h (derivado de los 20–35 días de la auditoría para 37 páginas, a escala) | 70–140 h |
| F4 relanzar (contenido, importadores como páginas, vídeo, comunidades) | 25–45 h | igual |
| **Total** | **230–420 h** | **185–340 h** |

| Horas/semana | Relanzamiento (alcance completo) | Relanzamiento (alcance mínimo) |
|---|---|---|
| 8 h | junio – noviembre 2027 | abril – septiembre 2027 |
| 12 h | **marzo – julio 2027** | **febrero – mayo 2027** |
| 20 h | febrero – abril 2027 | enero – marzo 2027 |

(Inicio el 10/11/2026; incluye dos semanas de margen por Navidad. Las horquillas son anchas porque F2 depende de cuántas rondas hagan falta.) **Tú eliges la fila en la decisión 5.** Cualquier fecha sin horas detrás es falsa.

### 7.2 Fases y puertas

| Fase | Fechas (a 12 h/semana) | Objetivo | Puerta de salida |
|---|---|---|---|
| **F0 Medir, asegurar, rescatar** | 10 nov – 5 dic | medición comprobada; red de pruebas con BD real; rescate; higiene de contexto; dominio activo | un evento emitido y visto en Web Analytics y en `analytics_events`; CUJ en verde contra Supabase real; interruptor probado en una ruta; `CLAUDE.md`; dominio principal con 308 y Search Console |
| **F1 Validar la cuña** | 17 nov – 12 dic (en paralelo) | datos sobre qué promesa convierte | ≥ 8 entrevistas sintetizadas; prueba de humo evaluada con su criterio (§7.3); decisión escrita |
| **F2 Identidad y dirección de arte** | 24 nov – 22 ene | brief, style tiles, sistema, prototipo de Inicio | pasos 1–6 de §6.1 aprobados (o decisión de encargar identidad) |
| **F3 Construcción v2.0** | 25 ene → según §7.1 | pantallas nuevas tras interruptor, una a una, con CUJ pasando en cada PR | 100 % de los flujos v2.0 en producción tras interruptor; CUJ, a11y y Lighthouse en verde |
| **F4 Relanzamiento** | 2 semanas tras F3 | importadores como páginas, comunidades, vídeo del diseño, prensa | medición semanal publicada; 4 semanas de distribución planificadas |
| **F5 Aprender y decidir** | +90 días | iterar con datos; v2.1 si procede | revisión go/no-go (§9) |

### 7.3 Detalle por fase

**F0 · Medir, asegurar, rescatar (10 nov – 5 dic)**

Víctor (≈ 2 h en paneles):
- Vercel → `kultura` → Analytics: activar **Web Analytics** y **Speed Insights**. Después, con Claude, emitir un evento de prueba y **verlo llegar** (en Vercel y en `analytics_events`); hasta entonces la medición no se da por arreglada.
- Comprar el dominio (`kulturaapp.es` recomendado) y **hacerlo principal ya** (308 desde `vercel.app`, `NEXT_PUBLIC_SITE_URL`, Supabase Site URL, Google OAuth): cada mes de espera es antigüedad de dominio perdida. Search Console y Bing con el dominio nuevo; enviar `sitemap.xml`.
- Supabase: reactivar `kultura-test` (pausado) para los tests de integración; o aceptar Supabase local en CI (abajo).
- Crear el proyecto nuevo «KULTURA 2.0» en claude.ai con: `00_CONSTITUCION.md`, `HANDOVER.md`, carpeta `auditoria/`. El actual queda como archivo.
- Custodia: confirmar dónde está la clave privada `age` de los backups y hacer **un simulacro de restauración** en `kultura-test` (hoy es una tarea pendiente, no una mitigación).

Claude (PRs con tu OK):
- `docs/FUNCIONES_V2.md` en el repo: inventario **del alcance v2.0** generado desde el código (pantallas reales por flujo, API que usa cada una, textos, estados, banderas) + lista de aparcados para v2.1. Git (`v1-ui`) es la memoria completa; esto es el índice.
- **Red de pruebas con BD real:** 8 recorridos críticos (registro, entrar, buscar y añadir, cambiar estado y progreso, crear lista y compartir, perfil público, importar CSV, exportar) con Playwright contra **Supabase local (CLI/Docker) en CI con las migraciones + `seed-test.mjs`** —de paso se comprueba que las migraciones reproducen el esquema— convirtiendo `tests/e2e/b3_5e_safety_net/*` (los únicos e2e con BD real) en vez de borrarlos. El mock de `tests/e2e/a11y/` se queda solo para a11y.
- **Interruptor de UI probado en una ruta:** cada `page.tsx` existente pasa a ser un conmutador que renderiza la pantalla vieja o la nueva según la cookie `ui_v2` (activable en `/api/ui-v2` para ti y probadores) o la variable `UI_V2_DEFAULT`; las pantallas nuevas viven en `src/v2/` (fuera de `app/`, para que no colisionen rutas). Se prueba con una ruta sencilla (p. ej. `/es/lists`) antes de generalizarlo.
- **PR de rescate:** mover los 11 `.ts` de lógica de `app/[locale]` a `src/lib/`; extraer `useAuthFlow` (login) y `useAccountSettings`; listar los 36 tests `.ts` que importan UI y los 13 `design|visual` con su destino.
- **Limpieza solo de lo que sobrevive:** `isNotMigrated` único y retirada de la tolerancia a migraciones ya aplicadas **en `lib`/`api`**, `server-only` en `admin.ts`, `three` y Geist fuera. La deuda de la UI vieja no se toca: se va con ella.
- Credibilidad inmediata: suelo de votos en los rankings de la portada o retirar el bloque hasta v2.0.
- `CLAUDE.md` en el repo con §8; `docs/` como fuente de verdad (el proyecto de claude.ai enlaza, no duplica).

**F1 · Validar la cuña (17 nov – 12 dic)**
- **Entrevistas (8–10, 20 min)** con usuarios de FilmAffinity que llevan series, ex-usuarios hispanohablantes de TV Time y miembros del Discord de anime y manga en español. Claude redacta el guion («Mom test»: qué hacen hoy, qué les duele, qué abandonaron) y sintetiza (`design:research-synthesis`); tú entrevistas o pasas un formulario. **Consentimiento explícito** si se graba; sin datos personales en los documentos.
- **Prueba de humo honesta:** dos mini-landings con el lenguaje de la landing v2, una por cuña (`/es/series`, `/es/anime`), cada una con su promesa y su CTA. Se publican 2 mensajes por comunidad en 3 comunidades por cuña (skill `kultura-post-reddit` donde las normas lo permitan; manual en Discord/Telegram) con UTM por cuña. Se mide por cuña: visitas, clics en CTA, altas, 3 títulos en 24 h.
- **Criterio con rama para «poco tráfico»:** concluyente solo si alguna cuña llega a **≥ 30 altas**; entonces gana la que más altas y activación tenga. Si ninguna llega (lo más probable con 0 audiencia), la prueba se declara **no concluyente** y la cuña la deciden la evidencia estructural (§2.2) y las entrevistas. Nunca se decide con altas de un dígito.

**F2 · Identidad y dirección de arte (24 nov – 22 ene)**
Pasos 1–6 de §6.1. Capacidades: tus skills locales (Taste, Impeccable, UI UX Pro Max, Design MD, Emil design-eng), `vectorlab-ux-skills:anti-slop/typography/colour-palette/motion`, `design:design-system`, `design:design-critique`, `frontend-design`, Adobe (`font_recommend`, `suggest_type_palettes`, Express para el logotipo), Figma (`figma-generate-design`) para style tiles; navegador integrado para probar; revisión independiente con `agentic-council:Artisan` y `Advocate`; ataque con `Skeptic`. Prototipos como HTML vivo publicado como artifact (pasos 4 y 6); nunca el lienzo Design.

**F3 · Construcción v2.0 (desde el 25 ene)**
- Orden por recorrido crítico y SEO: 1 Entrar/Crear cuenta · 2 Bienvenida · 3 Inicio · 4 Buscar · 5 Ficha pública de título · 6 Biblioteca (estados, progreso) · 7 Perfil público e invitación · 8 Listas y lista pública · [alcance mínimo termina aquí] · 9 Rankings · 10 Importar/Exportar · 11 Ajustes mínimos · 12 Legal y Manifiesto · 13 Landing coherente con el sistema final.
- Cada pantalla: rama `v2/<pantalla>` → preview de Vercel con `ui_v2` → tu «sí» por escrito → PR con tests del CUJ, capturas 390/1440, axe y Lighthouse en verde → squash-merge tras interruptor (producción sigue sirviendo la vieja al público).
- Textos: ES obligatorio; EN generado por Claude para mantener la paridad (revisión nativa en F5).
- Al completar los flujos: `UI_V2_DEFAULT=1`, dos semanas de observación, etiqueta `v1-ui`, borrado de la UI vieja de los flujos v2.0 (la de chat/grupos/calendario se conserva sin servirse hasta v2.1), `DISENO.md` nuevo.

**F4 · Relanzamiento (2 semanas tras F3)**
- Páginas de captación indexables: **«Vengo de FilmAffinity»** (pegar lista / marcador; el scraping del perfil público queda fuera hasta revisar sus términos **(no verificado)**), «Vengo de Trakt», «Vengo de Letterboxd», «Vengo de MyAnimeList», «Vengo de Goodreads», y «¿Guardaste tu exportación de TV Time?» como relato.
- Vídeo del diseño (15–30 s: el 3D y las portadas en movimiento) para TikTok/Reels/X con `video-making`/HyperFrames; recrear las tareas programadas (vigía diario, informe semanal) con Metricool/Typefully; comunidades hispanas; correo a Xataka Basics (publicó «Alternativas a TV Time» el 2/7/2026) y a creadores de series/anime en español.
- Legal al relanzar: política de privacidad actualizada (eventos de `analytics_events` de usuarios registrados, dominio nuevo), ficha Data Safety si hay TWA.

**F5 · Aprender y decidir (+90 días)**
Informe semanal automático (visitas, fuentes, embudo, retención); v2.1 (chat, grupos, calendario, alto contraste, TWA en Google Play) solo si la retención lo justifica; go/no-go (§9).

### 7.4 Modo mínimo (plan B si tus horas bajan a cero)
Producción sigue sirviendo la UI vieja; el cron diario mantiene Supabase activo; backups semanales siguen; la clave `age` está custodiada fuera del PC; los tests de contrato avisan si un proveedor cambia; aviso en la web de que la app está en pausa y la exportación disponible. Nada de esto requiere trabajo nuevo salvo custodiar la clave y comprobar el simulacro de F0.

### 7.5 Limpieza y refactorización (tres momentos, nunca mezclada con funciones)

Regla general: **un PR de limpieza o refactorización no cambia comportamiento** (mismos tests en verde antes y después, mismo resultado en los CUJ) y **nunca va en el mismo PR que una función o pantalla nueva**. Se limpia lo que sobrevive; lo que va a morir con la UI vieja no se pule.

| Momento | Qué se limpia | Herramienta / comprobación |
|---|---|---|
| **F0 (antes de construir)** | `isNotMigrated` ×3 → una; tolerancia a migraciones ya aplicadas (79 refs) y banderas con dos caminos **en `lib` y `api`**; `server-only` en `admin.ts`; dependencias muertas (`three`, `@types/three`); fuentes sin uso (Geist, 134 KB); entrada `src/pages` de `tailwind.config.ts`; 4 documentos citados que no existen (crear o quitar la cita); mover los 11 `.ts` de lógica de `app/[locale]` a `src/lib/` | `knip` (archivos, exports y dependencias sin uso) en modo informe; `tsc`, `vitest`, build |
| **Durante F3 (cada pantalla)** | solo los archivos que toca esa pantalla («deja el campo mejor de lo que lo encontraste», sin salirse del alcance) | revisor del PR comprueba que no hay cambios fuera del alcance |
| **Cierre de F3 (con `ui_v2` al 100 % y etiqueta `v1-ui`)** | borrado de la UI vieja de los flujos v2.0 (Anexo B); rutas de API que se queden sin consumidor; claves de `messages/` muertas (el test `dead-keys` ya existe); imágenes y archivos de `public/` sin referencia; tests y snapshots huérfanos; alias `legacy` de CSS/Tailwind; `components.json`; los 52 `as unknown as` de `lib/social` sustituidos por tipos generados (`supabase gen types`); estructura de carpetas final documentada en `docs/ESTRUCTURA.md` | `knip` en modo estricto en CI (falla si reaparece código muerto); Lighthouse y tamaño de JS comparados antes/después |
| **Documentación del proyecto de claude.ai** | los 74 handovers y documentos superados se archivan (no se usan); quedan constitución, `HANDOVER.md` y `auditoria/` | — |

Lo que **no** se toca aunque parezca desordenado: migraciones ya aplicadas en producción (no se renombran ni se fusionan aunque tengan fechas futuras o `rpc_discover_groups` creada y borrada: reescribirlas rompería el historial de Supabase); se documenta en `supabase/README.md`.

Coste: incluido en las horas de F0 (§7.1) y ~10–20 h adicionales al cierre de F3.

---

## 8. Sistema de trabajo (para que nada se pierda ni se invente)

### 8.1 Fuente única de verdad: el repo
`docs/` en el repo (lo ve Claude Code en local y cualquier sesión que clone): `00_CONSTITUCION.md` (este plan condensado + reglas), `01_PRODUCTO.md` (posicionamiento, cuña, `FUNCIONES_V2.md`, alcance, métricas), `02_DISEÑO_BRIEF.md`, `03_DESIGN_SYSTEM.md` (= `DISENO.md`), `04_DECISIONES_Y_RIESGOS.md` (registro con fecha, decisión, por qué, alternativa descartada; riesgos; métricas; **checklist RGPD**: consentimiento en entrevistas, privacidad actualizada con `analytics_events`, dominio, Data Safety, sin scraping de terceros sin revisar términos). El proyecto de claude.ai «KULTURA 2.0» guarda solo `00_CONSTITUCION.md`, un único `HANDOVER.md` (se sobrescribe) y `auditoria/`.

### 8.2 Reglas anti-alucinación y anti-pérdida
1. **Evidencia o nada:** afirmaciones sobre el código con ruta y línea; sobre el mercado, URL y fecha; sobre datos, la consulta. Lo no verificado, marcado.
2. **Implementador ≠ revisor:** todo entregable importante lo revisa un agente que no lo produjo, con briefing cerrado, y el resultado se registra (este plan: Anexo D). Nadie certifica su propio trabajo.
3. **Nada se borra sin red:** inventario + CUJ con BD real + rescate + etiqueta git; borrado solo al 100 % de `ui_v2`.
4. **Prototipo probado antes de enseñado:** capturas 390/1440, sin WebGL, reduced-motion, consola sin errores.
5. **Puertas por PR:** `tsc`, lint, unit, CUJ, axe, Lighthouse, capturas; squash-merge solo con tu OK explícito.
6. **Una sesión = un entregable** y un `HANDOVER.md` de ≤ 40 líneas; las decisiones van a `04_DECISIONES`.
7. **Memoria:** solo decisiones y preferencias durables; lo rechazado se registra una vez.
8. **Economía de tokens:** leer solo `docs/`; agentes para lo que requiere fan-out; informes en archivo, resumen de ≤ 15 líneas en el chat.
9. **No prometer lo que no se midió.**

### 8.3 Roles (agentes y skills) por tipo de trabajo
| Trabajo | Capacidad |
|---|---|
| Inventario funcional, búsqueda en el repo | `Explore` / `general-purpose` (solo lectura) |
| Recorridos críticos y auditoría de usabilidad | agentes `ux-agent-skills:cuj-author`, `cuj-auditor`, `usability-auditor` (skills `ux-spec`, `cuj-audit`, `ux-audit`) |
| Investigación con fuentes | `deep-research`, `agentic-council:Scout`, `product-management:competitive-brief` |
| Alcance y priorización | `agentic-council:Strategist` (`mvp-scoping`), `product-management:write-spec` |
| Diseño | tus skills (Taste, Impeccable, UI UX Pro Max, Design MD, Emil, d2c), `vectorlab-ux-skills:*`, `design:design-system/design-critique/ux-copy/accessibility-review`, `frontend-design`, `superdesign`, Adobe (fuentes, paletas, Express), Figma |
| Revisión independiente | `agentic-council:Artisan` (visual), `Advocate` (UX), `Skeptic` (riesgos), `Architect`, `Guardian` (privacidad) |
| Código | Claude Code local con Remote Control (móvil) + `engineering:code-review`, `craftsman-e2e-testing`; GitHub con permiso de push vía `add_repo` |
| Datos y despliegue | conectores Supabase (SQL, advisors, ramas, restaurar `kultura-test`), Vercel (analítica, logs, previews, dominios) |
| Crecimiento | `kultura-post-reddit`, Metricool, Typefully, TikTok for Business, `video-making`/HyperFrames, Gmail, tareas programadas |
| Documentación y traspaso | `agentic-council:handover`, `Chronicler`, `adr-template` |

### 8.4 Trabajo en local
Claude Code en tu PC dentro del repo con Remote Control. `CLAUDE.md` contiene §8.2 y §8.5 y apunta a `docs/`. Cada PR enlaza la preview aprobada.

### 8.5 Definición de «hecho» para una pantalla
Preview aprobada por escrito · CUJ en verde contra BD real · axe sin `serious/critical` a 390 y 1440 · Lighthouse dentro del presupuesto · reduced-motion y sin WebGL probados · textos ES (EN generado) · capturas en el PR · `HANDOVER.md` actualizado.

---

## 9. Métricas, éxito y parada

Hipótesis de crecimiento explícita: distribución semanal constante tras F4 (2–3 acciones/semana en comunidades y redes) y bucle de invitación; sin canal de pago.

| Momento | Métrica | Umbral |
|---|---|---|
| F0 | medición | un evento de prueba visto en Web Analytics y en `analytics_events` |
| F1 | validación | ≥ 8 entrevistas; prueba de humo concluyente solo con ≥ 30 altas por cuña |
| F2 | dirección de arte | 1 style tile ≥ 4/5 y aprobado; si tras 3 rondas no, encargo de identidad |
| F3 | calidad | 100 % CUJ en verde; 0 regresiones a11y; JS inicial ≤ 150 KB por ruta |
| F4 + 4 semanas | llegada y conversión | ≥ 1.000 visitas; visita → alta ≥ 3 % desde comunidades (≈ 30–50 altas) |
| F4 + 4 semanas | activación | alta → 3 títulos en 24 h ≥ 50 % |
| F4 + 90 días | retención y bucle | ≥ 3.000 visitas acumuladas; **≥ 150 altas reales**; vuelve a los 7 días **≥ 25 %**; ≥ 10 % de altas con `ref` |

**Decisión a +90 días:** ≥ 150 altas y D7 ≥ 25 % → seguir (v2.1, Hispanoamérica). 50–150 → cambiar de cuña o de canal, no de diseño. < 50 con la distribución hecha → parar o cambiar de producto. Fijado hoy para decidir con datos y no con ánimo.

---

## 10. Riesgos y mitigaciones

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| El rediseño vuelve a quedar genérico | media | alto | brief + anti-lista + rúbrica; revisor independiente; tope de 3 rondas y partida para identidad humana |
| Rediseñar para nadie | media | alto | F1 en paralelo con criterio honesto; evidencia estructural como respaldo |
| Pérdida de funciones al sustituir la UI | media | alto | inventario + CUJ con BD real + rescate + `v1-ui`; borrado solo al 100 % |
| Horas: jornada completa y cambio de puesto | alta | alto | calendario en horas (§7.1); alcance mínimo; modo mínimo (§7.4) |
| Interruptor de UI mal implementado (rutas que colisionan, caché) | media | medio | mecanismo fijado (conmutador por `page.tsx` + `src/v2/`), probado en una ruta en F0 |
| Tests verdes falsos con BD simulada | alta si no se corrige | alto | CUJ contra Supabase local/`kultura-test` |
| Cupos y estabilidad de proveedores (AniList 30 req/min, RAWG 20 K/mes, ComicVine 200/h) | media | medio | caché ≥ 24 h; alertas al 80 %; un formato degradado no tumba la app |
| Licencias si algún día hay ingresos | baja | alto | solo donaciones, tras confirmar con TMDB y ComicVine; sustitutos a evaluar (IGDB; Metron **no verificado**) |
| Supabase Free pausado por inactividad | media | alto | cron diario; alerta de UptimeRobot; simulacro de restauración |
| Reputación por IA | baja | medio | bajo demanda, nunca en portada, con tope |
| «¿Cuánto durará esto?» | alta | medio | Manifiesto; exportación visible; roadmap público |
| Rankings poco creíbles en portada | alta | medio | suelo de votos; o retirar hasta v2.0 |
| Context rot | alta | medio | `docs/` como fuente; un handover; `CLAUDE.md` |
| Vercel Hobby (CPU, imágenes, uso no comercial) | media | medio | CSP fija y caché de borde ya hechas; vigilar Usage |
| Dependencia de una sola persona | alta | alto | backups + simulacro; `docs/`; modo mínimo |

---

## 11. Lo que no estaba en tu planteamiento (añadido)

1. **Medir antes de nada**, y comprobar que la medición llega.
2. **Visitas ≠ diseño.** La llegada depende de distribución; el diseño decide conversión y retención.
3. **Cuña antes que pantallas**, con validación honesta (y una rama para «no concluyente»).
4. **Dominio propio ya**, como principal, pendiente desde el 22/10.
5. **Sostenibilidad y licencias**: anuncios y pagos bloqueados; donaciones solo tras confirmar con TMDB y ComicVine; respuesta pública a «cuánto durará».
6. **Costes y plan B** (§5.4, §7.4): Supabase se pausa, Vercel Hobby es solo no comercial, la identidad humana necesita partida.
7. **Credibilidad de los rankings** en la primera pantalla.
8. **Presencia en Google Play vía TWA** (25 $) en v2.1.
9. **Importadores como captación**, con FilmAffinity (único) por delante de TV Time (relato).
10. **Proceso de diseño con brief, anti-lista, rúbrica y tope de rondas**, y prototipos en la rama `v2` desde la segunda pantalla para no implementar dos veces.
11. **Red de seguridad real antes de borrar** (BD real, no simulada) e interruptor por ruta probado.
12. **Criterios de parada** fijados hoy.
13. **Marca:** «Kultura» es palabra común en varias lenguas; mantener el nombre pero usar siempre «KULTURA app» y dominio con apellido; renombrar solo si F1 muestra confusión real.
14. **Horas como variable principal**: ninguna fecha sin horas detrás.
15. **RGPD en el proceso**: consentimiento en entrevistas, privacidad actualizada, sin scraping sin revisar términos.

---

## 12. Decisiones que necesito de ti (responde con el número)

1. **Opción A (refundar sobre cimientos, borrado solo al 100 % de la UI nueva)**: ¿sí?
2. **Cuña principal**: series y películas en español (recomendada) / anime y manga / validar ambas en F1 con el criterio de §7.3 (recomendado).
3. **Dominio**: `kulturaapp.es` (recomendado) / `kulturaapp.app` / `kultura.watch` / otro. ¿Lo compras y lo haces principal esta semana?
4. **Sostenibilidad**: ¿aceptas una página «Manifiesto» fuera de la landing y que se consulte a TMDB/ComicVine sobre donaciones?
5. **Horas por semana** reales (8 / 12 / 20) y **alcance** (completo 12–13 flujos / mínimo 8). Eso fija la fecha (§7.1).
6. **Partida para identidad humana** si F2 no pasa la rúbrica en 3 rondas: ¿sí (orientativo 300–800 €), no, o decidir entonces?
7. **Proceso de prototipos**: style tiles y la primera pantalla como HTML; **desde la segunda pantalla, directamente en la rama `v2` sobre preview de Vercel** (nada llega a producción sin tu «sí»). ¿Aceptas este cambio respecto a tu regla del 4/11?
8. **Proyecto nuevo «KULTURA 2.0»** (constitución + handover + auditorías) y `docs/` en el repo como fuente de verdad: ¿sí?

Cuando respondas, la siguiente sesión arranca F0 por `FUNCIONES_V2.md`, el interruptor en una ruta y la red de pruebas con BD real (sin tocar producción) y te deja la lista exacta de paneles que solo puedes hacer tú.

---

## Anexo A — Alcance v2.0 / v2.1

| v2.0 completo (12–13 flujos) | v2.0 mínimo (8 flujos) | v2.1 (rehacer; solo si la retención lo justifica) |
|---|---|---|
| Entrar/Crear cuenta (login, alta, recuperar, callback, «revisa tu correo»), Bienvenida, Inicio, Buscar, Ficha pública (por familia de formato), Biblioteca (estados, progreso por episodio/capítulo/horas), Perfil público + invitación, Listas (índice, detalle, pública, colaborar), Rankings, Importar/Exportar, Ajustes mínimos (cuenta, privacidad, plataformas), Legal + Manifiesto, Landing coherente | los 8 primeros flujos de la columna anterior | Chat, grupos, calendario, notificaciones, sugerencias a amigos, correo semanal, push, tema de alto contraste, TWA en Google Play, resumen anual (dic-2027) |

## Anexo B — Borrado (SOLO cuando `ui_v2` sirve el 100 % y existe la etiqueta `v1-ui`)
**Se borra:** la UI vieja de los flujos v2.0 en `src/components/{ui,layout,home,library,media,social,collection,profile,best,search}/**` (salvo `Logo`, `icons`, `landing`) y sus `page.tsx`/`*Client.tsx`/`loading.tsx`/`error.tsx`; `tests/unit/**/*.test.tsx` y snapshots de esos flujos; `tests/e2e/auth.spec.ts`; `three`, `@types/three`, `GeistVF.woff`, `GeistMonoVF.woff`, `components.json`, `ui/input.tsx`; alias `legacy`; entrada `src/pages` del `content`; `DISENO.md` actual (conservar §Formularios/foco y §Retícula como reglas a11y).
**Se conserva sin servirse hasta v2.1:** UI vieja de chat, grupos, calendario, notificaciones, sugerencias, push (`components/{pwa,push}` incluidos).
**Se convierte, no se borra:** `tests/e2e/b3_5e_safety_net/*` → base de los CUJ con BD real.
**No se toca:** `supabase/**`, `src/lib/**`, `src/app/api/**`, `src/types/**`, `src/i18n/**`, `messages/**`, `VOZ.md`, `tests/unit/**/*.test.ts` (tras revisar los 36 + 13 listados), `tests/integration/**`, `tests/contract/**`, `tests/e2e/a11y/*.cjs`, `.github/workflows/**`, `lighthouserc.json`, `vercel.json`, `sentry.*`, `public/sw.js`, `components/landing/*`, fuentes `Bricolage/Figtree/KulturaDisplay`, `components/icons`, `components/layout/Logo.tsx`, `scripts/**`.

## Anexo C — Hechos verificados hoy fuera de los informes (búsquedas del 5/11/2026)
- **TV Time** cerró el 15/7/2026 (TechCrunch 2/7/2026; MacRumors; Neowin; ArchiveTeam); 26,4 M instalaciones **globales** (Appfigures vía Moviebase); exportación RGPD solo hasta esa fecha; JustWatch publicó herramienta de migración el 9/7/2026 (9to5mac). Otros servicios lanzaron importadores en julio.
- **Trakt:** límites gratis de feb-2025 (100 ítems, 2 listas; VIP 30→60 $/año; AlternativeTo 7/2/2025, foro oficial) y actualización 2026 (foro oficial «Updating Trakt Limits for 2026», visto en resultados de búsqueda; la página del foro ha migrado): 250 ítems en watchlist, 250 por lista, 5 listas, 100 K historial.
- **Letterboxd:** 30,7 M miembros al cierre del 2.º trimestre de 2026, +43 % interanual (informe de Tiny citado por Law Commentary 28/9/2026); proceso de venta con valoración de 250 M $ (Variety, jul-2026) a > 300 M $ (NYT vía Law Commentary, sep-2026).
- Disponibilidad de dominios a 5/11/2026 según el registro de Vercel (§1.1). Precio no obtenido (la API de precios devolvió 400).

## Anexo D — Registro de la revisión independiente (5/11/2026)
Revisor: agente `agentic-council:Skeptic` sin contexto previo, con acceso al plan, a las dos auditorías y al repo. 24 observaciones: 6 graves, 12 medias, 6 leves. Cambios aplicados en v1.1:
- **Graves:** calendario recalculado en horas (§7.1) y fecha como función de horas y alcance; «pantallas» → «flujos» con 25–35 pantallas reales (§5.2, Anexo A); mecanismo del interruptor de UI especificado y probado en F0 (§7.3); red de pruebas con **BD real** en lugar del mock de Supabase, convirtiendo `b3_5e_safety_net` (§7.3, Anexo B); cuña apoyada en el hueco estructural (FilmAffinity/Serializd) con TV Time como relato (§0.5, §2, §5.1); prueba de humo con mini-landings por cuña y rama «no concluyente» (§7.3).
- **Medias:** F0 ampliado a 4 semanas; Trakt 100→250 con fuentes; licencias corregidas (RAWG comercial bajo límites; TMDB y ComicVine por confirmar); 36 + 13 tests `.ts` atados a UI/tokens listados; regla única de borrado al 100 % con `v1-ui`; v2.1 = rehacer (estimación propia); dominio principal en F0; tabla de costes y partida de identidad; métricas unificadas (D7 ≥ 25 %, 150 altas a 90 días) con hipótesis de crecimiento; limpieza solo en `lib`/`api`; inventario solo del alcance v2.0; repo como fuente única; prototipos en rama `v2` desde la segunda pantalla; EN generado, no bloqueante.
- **Leves:** medición «comprobada con un evento»; afirmaciones sin respaldo marcadas o eliminadas (opción D, Hardcover, Metron); checklist RGPD; modo mínimo (§7.4) y simulacro de restauración; oscuro como identidad + alto contraste en v2.1; esta revisión registrada como el paso «implementador ≠ revisor» en lugar de autocertificación.
