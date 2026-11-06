# F1 · Entrevistas para validar la cuña (guion «Mom test»)

**Fase:** F1 (`PLAN_ESTRATEGICO.md` §7.3). **Decisión que alimenta:** D2 (`04_DECISIONES_Y_RIESGOS.md`).
**Quién hace qué:** Víctor entrevista o pasa el formulario; Claude sintetiza con `design:research-synthesis` cuando haya 8–10 entrevistas (`docs/F1_SINTESIS.md`, otra sesión).
**Regla de oro:** se pregunta por **lo que la persona hizo**, nunca por lo que haría. No se presenta ningún producto, no se describen ideas y no se habla de dinero.

---

## 0. Qué decide este documento

| Cuña | Promesa que se valida (no se enseña) | Hipótesis de dolor (solo para quien sintetiza) |
|---|---|---|
| **A** · Series y películas en español | Llevar al día lo que ves, por episodio, en tu idioma, sin perder tus datos | FilmAffinity no lleva episodios ni exporta; Trakt está en inglés; TV Time cerró el 15/7/2026 (plan §0.5, §2.1–2.2 y `MERCADO_2026.md` [16][22][25][31]) |
| **B** · Anime y manga en español | Lo mismo para anime (episodios) y manga (capítulos y tomos) | Las herramientas grandes están en inglés, son inestables o se han vendido (§2.1) |

**Pregunta de decisión:** ¿en qué cuña hay un dolor **frecuente**, **intenso** y con **apaños activos** (gastan tiempo o han probado varias herramientas)? La regla de decisión está escrita de antemano, en §6.4.

**Cuota:** 8–10 personas, **4–5 por cuña**, con **al menos 3 en directo por cuña**. En A, al menos 2 ex-usuarios de TV Time y 2 personas que usen FilmAffinity para series. En B, al menos 2 que lean manga además de ver anime y, si aparece, 1 persona cuya herramienta de anime o manga haya cerrado o cambiado de dueño, para equilibrar el sesgo de A2 (§6.1, paso 3). En cada cuña, como mucho 2 personas del círculo cercano de Víctor (sesgo de cortesía).

**Riesgo asumido:** este archivo está en un repo público y un participante podría leer la columna de hipótesis. Por eso a nadie se le da la URL del repo ni el nombre del proyecto hasta cerrar F1.

---

## 1. Perfiles y dónde encontrarlos

### 1.1 Filtro (3 preguntas antes de quedar; si alguna falla, no se entrevista)

| Perfil | P1 | P2 | P3 |
|---|---|---|---|
| A1 · FilmAffinity con series | ¿Has puntuado o guardado algo en FilmAffinity en los últimos 3 meses? | ¿Cuántas series has seguido este año, aunque las dejaras? (≥ 2) | ¿Tienes 18 años o más? |
| A2 · Ex-TV Time | ¿Usabas TV Time antes de que cerrara? | ¿Cuántas series has seguido este año, aunque las dejaras? (≥ 2) | ¿Tienes 18 años o más? |
| B · Anime y manga | ¿Cuántos animes has seguido este año, aunque los dejaras? (≥ 2) | ¿Has leído manga en los últimos 3 meses (papel o digital)? (sí en ≥ 2 de B) | ¿Tienes 18 años o más? |

Todas las preguntas son de conducta pasada o de edad. El idioma no se pregunta: se deduce de la conversación y del canal, para no revelar que es una variable. Si alguien responde «no» a la P3, se le da las gracias y no se le entrevista.

### 1.2 Canales (consultados el 2026-11-07 salvo indicación)

| Perfil | Canal | URL | Lo que se comprobó | Cómo pedir participantes |
|---|---|---|---|---|
| B | Discord «Club de Anime y Manga en Español» | https://discord.com/servers/club-de-anime-y-manga-en-espanol-758717909521924107 | Existe. 18.821 miembros en su ficha pública (el buscador de Discord da 17.682 «aproximados»). En español; también se habla de cine y series. | Las normas internas solo se ven dentro del servidor **(no verificado)**. Unirse, leer las normas y **preguntar antes a la moderación**. Si hay un canal de anuncios o encuestas, usarlo. |
| A1, A2 | Mediavida · foro «Televisión» | https://www.mediavida.com/foro/tv | Existe y tiene hilos de estrenos de este otoño. | Según la ayuda (https://www.mediavida.com/ayuda/), cada foro tiene su moderación y se le escribe por mensaje privado a `/foro/tv`. **Pedir permiso antes** de abrir un hilo. |
| A1 | Mediavida · foro «Cine» | https://www.mediavida.com/foro/cine | Existe y está activo. | Igual que el anterior (`/foro/cine`). |
| B | Mediavida · foro «Anime y manga» | https://www.mediavida.com/foro/anime-manga | Existe. | Igual (`/foro/anime-manga`). |
| A1 | FilmAffinity | https://www.filmaffinity.com/es/ | No tiene foro público. Lo social son las críticas, los «Almas gemelas» y los mensajes entre usuarios, con grupos privados por defecto (FAQ: https://www.filmaffinity.com/gt/faq.php). | **No se capta dentro de FilmAffinity**: mandar mensajes sin pedirlo sería spam. A1 se encuentra en los demás canales con la pregunta P1 del filtro. |
| A2 | Ex-usuarios de TV Time | — | No hay comunidad propia: TV Time cerró el 15/7/2026. Su cofundador lanzó Bingers hacia el 4/8/2026, con importación del archivo de TV Time (TechCrunch, https://techcrunch.com/2026/08/04/tv-time-co-founder-launches-bingers-to-revive-the-beloved-tv-tracking-app/, consultado el 2026-11-07). | Se capta en Mediavida «Televisión» y por bola de nieve (pregunta final del guion). **Ojo:** quien ya migró a Bingers, JustWatch o Simkl es un dato, no un descarte. |
| A, B | Reddit (r/spain, r/TVTime, subreddits de anime en español) | — | **No verificado.** Reddit bloquea las consultas automáticas desde esta sesión y no se pudo confirmar qué subreddits existen ni sus normas. | Víctor los abre a mano, anota la URL, los miembros y la norma sobre encuestas y peticiones de participantes, y fecha la consulta. Si el sub no las permite, no se publica. (La skill de publicar en Reddit es para la prueba de humo, no para esto: allí sí se nombra el proyecto.) |
| A, B | Bola de nieve | — | — | Al final de cada entrevista, la última pregunta del guion. Es el canal más fiable con audiencia cero. |

**Canales descartados:** cualquier servidor que reparta series o anime sin licencia, por ejemplo «Japan Paw!» (https://discord.com/servers/japan-paw-294403414442639360, que en su ficha dice ofrecer anime gratis, doblado o subtitulado), o «Pelis y Series de Sobra» (discord.me). No se capta en ellos.

### 1.3 Mensaje de captación (neutro, sin nombre de producto ni incentivo)

> Hola. Estoy investigando cómo se organiza la gente con las series (o el anime y el manga) que ve. No es publicidad y no enseño nada. Busco a mayores de 18 que quieran contarme su experiencia en una llamada de 20 minutos, o en un formulario de unos 15 si lo prefieres. No pido nombre ni datos personales. Si te apetece, escríbeme por privado. ¡Gracias!

Ajustes según el canal: «series» para A y «anime y manga» para B. Nunca se enlaza a ninguna web propia.

---

## 2. Guion de 20 minutos

**Antes:** leer el consentimiento (§4) y apuntar solo el código `E0x` y el perfil. **Durante:** hablar el 20 % del tiempo como mucho. Repreguntar con «¿la última vez qué pasó?» y «¿me lo cuentas paso a paso?». No llenar los silencios.

| Min. | Bloque | Preguntas (en este orden; las marcadas con * son obligatorias) |
|---|---|---|
| 0–2 | Consentimiento | Texto de §4. «¿Te parece bien? ¿Puedo grabar solo el audio, o prefieres que tome notas?» Decirle su código `E0x`. |
| 2–6 | Qué hacen hoy | *1. Cuéntame la última serie (B: el último anime o manga) que empezaste. ¿Cómo diste con ella? · *2. ¿Cómo sabes ahora mismo por qué episodio (B: capítulo o tomo) vas? Descríbemelo paso a paso. No se pide que enseñe la pantalla: podría verse información de otras personas. · 3. ¿Cuántas llevas a la vez, más o menos, ahora mismo? |
| 6–12 | Qué pasa cuando se tuerce | *4. Si en P1–P3 contó un problema: «¿Cuándo fue la última vez que pasó? ¿Qué hiciste?». Si no contó ninguno: «¿Te ha pasado alguna vez no saber por dónde ibas o enterarte tarde de un estreno?». Si dice que no, se anota `sin-dolor` y se pasa a P8. · *5. ¿Cuánto tiempo te llevó resolverlo? · 6. Cuéntame la última vez que apuntaste o actualizaste por dónde ibas. ¿Qué hiciste exactamente? · A: 7a. ¿Usas FilmAffinity (o algo parecido) para las series? ¿Qué haces ahí y qué haces fuera? · B: 7b. ¿El anime y el manga los llevas en el mismo sitio o en sitios distintos? ¿Por qué? |
| 12–16 | Qué abandonaron | *8. ¿Has usado alguna app, web, nota u hoja para esto y la has dejado? ¿Cuándo y por qué? · *9. ¿Qué pasó con lo que tenías apuntado? · A2: 10a. Cuando cerró TV Time, ¿qué hiciste paso a paso? ¿Qué perdiste? · 11. ¿Has buscado alguna vez otra herramienta? ¿Qué buscaste y qué encontraste? |
| 16–19 | Con quién | 12. ¿Con quién comentas lo que ves? ¿Dónde (en persona, por WhatsApp, Discord, foros…)? · 13. ¿La última vez que alguien te recomendó algo, cómo te llegó y qué hiciste con ello? |
| 19–20 | Cierre | *14. ¿Hay algo de cómo llevas esto que no te haya preguntado y debería? · *15. ¿Conoces a alguien que lo lleve de forma muy distinta a ti y con quien pueda hablar? |

**Tiempo:** son 9 preguntas obligatorias (*). Si a los 12 minutos no se ha llegado al bloque «Qué abandonaron», se saltan la 3, la 6, la 11 y la 13. Vale más una historia contada entera que todas las preguntas.

**Preguntas prohibidas**, porque invitan a opinar o a quedar bien: «¿usarías…?», «¿te gustaría que…?», «¿pagarías…?», «¿qué te parece la idea de…?», «¿sería útil…?», «¿cuánto valorarías…?», y cualquier descripción de una solución. Si la persona pregunta qué se está montando: «Prefiero no contarlo para no influirte. Cuando termine esta ronda de charlas te lo cuento si quieres». No se le cuenta antes de cerrar F1, para no contaminar a quien recomiende en la P15.

**Señales que hay que anotar**, porque valen más que las opiniones:
- **Apaño activo:** hoja de cálculo, notas, capturas, varias apps a la vez.
- **Coste real:** tiempo perdido, spoilers, episodios repetidos o saltados, datos perdidos.
- **Intento de solución:** ha buscado, probado o migrado algo.
- **Emoción:** frustración que nombra sin que se le pregunte.
- **Ausencia de dolor:** «me da igual», «lo llevo de memoria». Se anota también: es un resultado válido.

---

## 3. Versión en formulario (cuando no hay entrevista en directo)

**Herramienta sugerida:** Tally, que dice alojar los datos en la UE **(no verificado)**, o Google Forms. **Lo crea Víctor**: aquí no se crea ni se publica nada. Las respuestas no se recogen con la cuenta del encuestado: en Google Forms, desactivar «Recopilar correos» y «Limitar a 1 respuesta», que obliga a iniciar sesión. Dura unos **15 minutos**.

**Portada:** el texto de §1.3, más el consentimiento de §4 adaptado («No grabamos nada; tus respuestas se guardan sin tu nombre»). Dos casillas obligatorias: «Tengo 18 años o más» y «He leído esto y acepto participar». Al final, la página de gracias muestra un código aleatorio (`F-xxxx`) que sirve para pedir el borrado.

| # | Campo (abierto salvo indicación) | Equivale a |
|---|---|---|
| 0 | ¿Qué sigues más? (opción única: Series y películas / Anime y manga / Las dos por igual) | Asigna la cuña. Si responde «las dos», va a la cuña con menos participantes en ese momento, y se anota. |
| 1 | Cuéntanos la última serie o anime que empezaste. ¿Cómo diste con ella? | P1 |
| 2 | ¿Cómo sabes ahora mismo por qué episodio, capítulo o tomo vas? Descríbelo paso a paso. | P2 |
| 3 | ¿Te ha pasado alguna vez no saber por dónde ibas o enterarte tarde de un estreno? Si te ha pasado, cuéntanos la última vez y qué hiciste. (Se puede dejar en blanco.) | P4–P5 |
| 4 | Cuéntanos la última vez que apuntaste o actualizaste por dónde ibas. ¿Qué hiciste exactamente? | P6 |
| 5 | ¿Qué usas o has usado para llevar la cuenta (apps, webs, notas, hojas, nada)? **Campo abierto, sin lista**, para no sugerir nombres ni favorecer una cuña. | P8 |
| 6 | Si dejaste alguna, ¿cuál, cuándo y por qué? ¿Qué pasó con lo que tenías apuntado? | P8–P9 |
| 7 | Si usabas TV Time: ¿qué hiciste cuando cerró? (opcional) | P10a |
| 8 | ¿Con quién comentas lo que ves y dónde? | P12 |
| 9 | ¿Algo que no te hayamos preguntado y deberíamos? | P14 |
| 10 | **Opcional, en una sección aparte:** si aceptas una charla de 20 min, un medio de contacto. Se borra según el plazo de §4. | P15 |

**Antes de pasarle respuestas a Claude:** Víctor revisa los campos abiertos y quita lo que pueda identificar a alguien (nombres, usuarios, lugares, trabajos). El campo 10 no se pasa nunca.

**Límites:** el formulario no repregunta, así que pesa la mitad que una entrevista en la síntesis (§6.2). Como mucho, 4 de las 8–10 «entrevistas» pueden ser formularios.

---

## 4. Consentimiento y datos personales

**Texto que se lee al empezar** (en el formulario, en la portada):
> «Gracias por tu tiempo. Esto dura unos 20 minutos. Quiero entender cómo llevas las series (o el anime y el manga); no hay respuestas buenas ni malas y no es publicidad. Quien guarda estas notas soy yo, Víctor, a título personal. No apunto tu nombre: en mis notas serás el código **E0x**, que te doy ahora. Si me dejas, grabo **solo el audio** para no perder detalles; lo guardo en mi ordenador, nunca en internet ni en documentos compartidos, y lo borro en un máximo de 30 días después de terminar el análisis. Puedes no contestar a cualquier pregunta, parar cuando quieras y, cuando quieras, pedirme por este mismo canal que borre lo tuyo diciéndome tu código. ¿Te parece bien? ¿Y la grabación?»

- **Dos «sí» separados:** uno para participar y otro para grabar. Si no hay un «sí» a la grabación, no se graba: solo notas.
- **Para que conste**, el consentimiento se graba al inicio del audio. En el formulario, cuenta la casilla obligatoria.
- **Dónde están los datos:** el audio y el contacto opcional, solo en el equipo de Víctor, fuera del repo (público) y fuera de claude.ai. A Claude se le pasan las **notas ya anonimizadas** (§5), nunca el audio ni las transcripciones completas.
- **Transcripción:** a mano, o con una herramienta que funcione en local. Nunca con un servicio en la nube, porque sería contradecir lo prometido en el consentimiento.
- **Responsable y contacto:** Víctor, a título personal. La retirada se pide por el mismo canal por el que se contactó, dando el código `E0x` o `F-xxxx`. La tabla que une códigos y canal está solo en el equipo de Víctor y se borra con el audio.
- **Lo que nunca entra en `docs/`:** nombres, alias, usuarios de Discord, FilmAffinity u otras redes, correo, teléfono, edad exacta, ciudad, empleo, enlaces a perfiles, capturas con datos, ni citas que permitan identificar a alguien (que mencionen un lugar, un trabajo o una persona). Lo que sí: el código `E01–E10`, el perfil (A1/A2/B), el país, una franja de edad declarada voluntariamente (`<25`, `25–40`, `>40`) y el modo (directo o formulario).
- **Borrado:** audio y contactos, en un máximo de 30 días tras cerrar `F1_SINTESIS.md`. Víctor anota la fecha de borrado en la tabla de §5.2, sin más datos.
- **Retirada:** si alguien lo pide, se borran su audio, sus notas y sus citas en la síntesis, y su código queda como «retirado».
- **Menores de edad:** la edad se pregunta en el filtro (P3, §1.1) y en el formulario es una casilla obligatoria. Solo participan mayores de 18. Es la opción más prudente: el umbral de 14 años de la LOPDGDD no se ha revisado aquí **(no verificado)**.

---

## 5. Plantilla de notas por entrevista

Un archivo por entrevista en una carpeta privada de Víctor. Al repo solo llega la versión anonimizada, si llega.

```markdown
## E0x · perfil A1 | A2 | B · país · franja de edad (opcional) · directo | formulario · AAAA-MM-DD
Canal: (Mediavida tv / Discord club anime / bola de nieve de E0y / …)
Grabación: sí | no      Fecha prevista de borrado: AAAA-MM-DD

### Hechos (lo que hizo, con citas literales cortas y sin datos que identifiquen)
- Cómo lleva hoy la cuenta: …
- Herramientas actuales: …
- Número aproximado a la vez: …

### Dolores
| Dolor (en sus palabras) | Última vez | Frecuencia 1–3 | Intensidad 1–3 | Apaño actual |
|---|---|---|---|---|
| | | 1 = alguna vez al año · 2 = al mes · 3 = a la semana | 1 = molesta · 2 = le cuesta tiempo o spoilers · 3 = pérdida o abandono | |

### Abandonos
| Qué dejó | Cuándo | Por qué (sus palabras) | Qué pasó con sus datos |
|---|---|---|---|

### Señales de compromiso (marcar)
- [ ] Apaño activo  - [ ] Ha buscado o probado otra herramienta  - [ ] Perdió datos  - [ ] Emoción no inducida  - [ ] Ofreció contactos (P15)  - [ ] Sin dolor real

### Social
Con quién y dónde lo comenta: …

### Sorpresas (lo que no esperaba quien entrevista)
- …

### Errores del entrevistador (honestidad)
- ¿Indujo alguna respuesta? ¿Habló de soluciones? …
```

### 5.2 Registro (este sí puede ir al repo, en `F1_SINTESIS.md`)

| Código | Perfil | Modo | Fecha | Canal | Grabación | Borrado (fecha) |
|---|---|---|---|---|---|---|
| E01 | | | | | | |

---

## 6. Criterios de síntesis (cuando haya 8–10)

Método: `design:research-synthesis`, con su salida (resumen, temas con prevalencia «X de Y» y evidencia citada, insights → oportunidades, segmentos, recomendaciones, preguntas abiertas y notas de método) en `docs/F1_SINTESIS.md`. Se separan siempre **observación** («4 de 5 en B llevan el manga en otra app») e **interpretación**.

### 6.1 Pasos
1. **Etiquetar** cada hecho y dolor de las notas con un código corto (`episodio-perdido`, `estreno-perdido`, `datos-perdidos`, `multi-app`, `idioma`, `sin-social`, `sin-dolor`…). El libro de códigos se cierra después de **2 entrevistas de cada cuña**, y los añadidos posteriores se anotan.
2. **Mapa de afinidad por cuña:** agrupar las etiquetas en temas. Un tema **cuenta** si aparece en **≥ 3 personas** del total, o en **≥ 2 de la misma cuña**. Por debajo se queda como «señal».
3. **Puntuar el dolor:** por persona y por tema, `frecuencia × intensidad` (1–9). Se cuenta como **dolor fuerte** un 6 o más **con** un apaño activo o un intento de solución. El dolor causado **solo** por el cierre de TV Time (o de otra herramienta) se etiqueta `cierre-forzoso` y se informa aparte: no cuenta como dolor fuerte salvo que siga hoy (por ejemplo, si aún no ha encontrado sustituto).
4. **Codificación ciega:** un subagente que no conozca la hipótesis ni la cuña de cada persona (se le quitan perfil, P7 y P10) puntúa frecuencia, intensidad y «satisfecho» a partir de las notas. Se compara con la puntuación de Víctor. Las discrepancias de ≥ 2 puntos se discuten y se registran, y si no hay acuerdo **manda la puntuación ciega**.
5. **«Ya resuelto y satisfecho»** se define por conducta: no ha buscado otra herramienta en los últimos 6 meses **y** no cuenta ninguna pérdida ni ningún apaño. No se le pregunta a la persona si está satisfecha.
6. **Abandonos:** tabla de qué dejaron y por qué, que alimenta los principios de producto (§5.2 del plan), no la elección de cuña.
7. **Sesgos que hay que declarar:** cuántas personas son del círculo de Víctor, cuántos formularios, canal de origen y errores del entrevistador anotados.

### 6.2 Pesos
- Entrevista en directo = 1. Formulario = 0,5.
- Una persona del círculo cercano de Víctor = 0,5 (si además es formulario, 0,25).
- Una cita solo vale como evidencia si es de conducta («la semana pasada me…»), no de opinión.

### 6.3 Por cuña, la tabla que decide

| Cuña | Personas (peso) | Con dolor fuerte (peso) | % | Temas que cuentan | Apaños activos | Ya resuelto y satisfecho |
|---|---|---|---|---|---|---|
| A | | | | | | |
| B | | | | | | |

### 6.4 Regla de decisión (escrita antes de entrevistar; no se cambia después)
- **Cómo se calcula el %:** el peso de las personas con dolor fuerte, dividido entre la suma de pesos de todas las personas de esa cuña (§6.2). Para que el cálculo valga, cada cuña necesita al menos 3 entrevistas en directo; si no las tiene, la cuña es «sin datos» y no puede ganar.
- **Gana una cuña** si su porcentaje ponderado con dolor fuerte es **≥ 50 %**, **y** cuenta con al menos **3 personas en directo con dolor fuerte**, **y** supera a la otra en **≥ 1,5 personas ponderadas**.
- **Empate**, si ninguna cumple las tres condiciones: decide la evidencia estructural de §2.2, que señala a **A**, y se registra como «A por evidencia estructural, entrevistas no concluyentes». **Esta asimetría es a propósito:** el plan (§5.1) ya elige A como cuña principal, así que B tiene que ganarse el puesto con datos y A no tiene que hacer nada para conservarlo.
- **Alerta roja:** si **≥ 50 %** de una cuña está «ya resuelto y satisfecho» con lo que usa, esa cuña **no puede ganar** por entrevistas, aunque gane por estructura. Se anota como riesgo en `04_DECISIONES`.
- **Cruce con la prueba de humo** (§7.3): si alguna cuña llega a ≥ 30 altas, la prueba de humo manda y las entrevistas explican el porqué. Con < 30 altas en ambas, mandan esta regla y §2.2. Nunca se decide con altas de un dígito.
- **Salida:** `docs/F1_SINTESIS.md` y una fila nueva en `04_DECISIONES` §1, con la cuña elegida, la tabla de §6.3 y los sesgos de §6.1, paso 7. La síntesis también la revisa un subagente que no la haya escrito (regla 2).

---

*Fuentes del plan citadas: `PLAN_ESTRATEGICO.md` §0.5, §2.1–2.2, §5.1 y §7.3 (no están en el repo público). Canales consultados el 2026-11-07, salvo los marcados como «(no verificado)».*
