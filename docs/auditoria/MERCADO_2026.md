# MERCADO — Apps de watchlist / tracking cultural (estado a 5-nov-2026)

**Objeto:** evaluar si KULTURA (https://kulturaapp.vercel.app) aporta algo que no exista.
**Método:** búsquedas web (ES/EN) y lectura de fuentes primarias (webs oficiales, App Store, docs de API, foros/Reddit, prensa). Cada cifra lleva referencia `[n]` a la sección 8 (URL + fecha). Lo que no se pudo comprobar se marca **(no verificado)**. Los datos de tráfico Semrush/Similarweb son estimaciones (y Semrush muestra cuotas anómalas de Bangladesh, probable ruido de bots/VPN): úsense como orden de magnitud.

**KULTURA en 3 líneas (visita 05-11-2026 [88]):** web app gratuita y sin anuncios, en español con versión en inglés, que unifica en una sola biblioteca películas, series, anime, manga, videojuegos, libros y cómics, con estados (pendiente/en curso/completado/abandonado), progreso, notas, listas colaborativas, amigos, recomendaciones IA bajo demanda (Claude) y exportación JSON. La portada no muestra cifras de usuarios; la biblioteca y las listas son privadas por defecto.

---

## 1) Tabla comparativa de competidores

Leyenda formatos: 🎬 cine · 📺 series · 🎌 anime · 📖 manga · 🎮 juegos · 📚 libros · 🗯 cómics. "ES" = interfaz en español.

| App | Formatos | Plataformas | Precio / límites free | ES | Social | Importación | Tamaño (fuente) | Estado 2026 |
|---|---|---|---|---|---|---|---|---|
| **Letterboxd** | 🎬 (TV anunciada en 2023, sin lanzar) | Web, iOS, Android | Free con anuncios; Pro 19,49 €/año, Patron 50,99 €/año; stats/filtros/import CSV solo Pro [3][4] | No (solo inglés) [4] | Sí (feed, listas, reseñas) | CSV (Pro) [3] | >30 M miembros jul-2026; ~87,7 M visitas/mes sep-2026 [1][2][70] | En venta (Netflix, Sony, Paramount… en conversaciones); Video Store TVOD lanzada 10-12-2025 en 23 países incl. España [1][9] |
| **Trakt** | 🎬📺 (anime como TV) | Web, iOS, Android, TV | Free: 100 ítems combinados watchlist+colección, 2 listas de 100; VIP 5,99 $/mes o 59,99 $/año (antes 30 $) [11][13][16] | No (inglés) [16] | Sí (comentarios, listas) | CSV/JSON manual; importa TV Time [17][25] | ~8,3 M visitas/mes sep-2026 [71] | Precios x2–x4 en 2025; rediseño "LITE" (nov-2025) mal recibido; foro cerrado, comunidad movida a r/trakt [12][14][15] |
| **TV Time** | 🎬📺 | iOS/Android | Gratis | Sí | Sí | — | 26,4 M instalaciones; Whip Media decía >25 M usuarios [22] | **Cerrada el 15-07-2026** ("insostenible como app gratuita, sin demanda de app de pago") [22][23] |
| **Simkl** | 🎬📺🎌 | Web, iOS, Android, extensiones | Free ilimitado con anuncios; Pro/VIP (listas privadas, import de listas, colaboración hasta 10 personas solo VIP) [18][19] | Parcial (no verificado) | Sí (reseñas, listas públicas) | 20+ servicios (Trakt, IMDb, Netflix, MAL) [18] | ~4 M visitas/mes sep-2026; España 3,4 % [72] | Beneficiaria de Trakt/TV Time; servidores saturados en jul-2026 [23] |
| **Serializd** | 📺 | Web, iOS, Android | Gratis (sin IAP visibles) [28] | No (EN/FR/IT) [28] | Sí (seguir, reseñas por episodio) | No consta | 2,2 K valoraciones App Store; ~2,8 M visitas/3 meses; **España 2.º país (7,7 %)** [28][29] | Activa, "Rewatch 2025", widgets, votaciones Emmy [28] |
| **FilmAffinity** | 🎬📺 (sin episodios) | Web, apps | Gratis con publicidad | **Sí** | Limitado (listas, críticas) | **Sin exportación oficial** (solo scrapers) [31] | **28,6 M visitas/mes sep-2026, 65 % España** [30] | Referencia en español; no valora series capítulo a capítulo [25] |
| **SensaCine** | 🎬📺 | Web, apps | Gratis | Sí | Seguir amigos (Facebook) | — | n/d | Marca episodios vistos con calendario de EE. UU.; no es tracker avanzado [32] |
| **JustWatch** | 🎬📺 (guía streaming) | Web, apps, TV | Gratis (ads/B2B) | Sí | No | — | >40 M usuarios/mes (nov-2023); ~80 M visitas/mes sep-2026 [34][35] | Lanza JustWatch TV; su dato "dónde ver" alimenta TMDB [34][76] |
| **Plex Watchlist** | 🎬📺 | Apps | Plex Pass 6,99 $/mes, 69,99 $/año, 249,99 $ vida (desde 29-04-2025) [36] | Sí | Limitado | — | ~54 M visitas/mes plex.tv [35] | Subida de precios 2025 [36] |
| **IMDb / TMDB / MovieLens / Kinorium / Reelgood** | 🎬📺 | Web/apps | Gratis | IMDb/TMDB sí; resto no verificado | Mínimo | IMDb CSV | n/d | Listas básicas; no son redes de tracking (no verificado en detalle) |
| **MyAnimeList** | 🎌📖 | Web, iOS/Android | Gratis con anuncios; Supporter | No | Sí (foros, clubs) | — | ~20 M miembros; ~78,6 M visitas/mes sep-2026 [38][73] | Comprada por Gaudiy (Web3/IA) may-2025; bloqueada en Rusia oct-2025; UI sin rediseño [37][39][44] |
| **AniList** | 🎌📖 | Web (apps 3.º) | Gratis, donaciones | No | Sí | MAL | ~18,2 M visitas/mes sep-2026 [42] | API degradada a 30 req/min "temporalmente" [41] |
| **Kitsu** | 🎌📖 | Web | Gratis | No | Sí | — | n/d | Apps retiradas (Android abr-2024), desarrollo parado; un mirror anuncia cierre 11-11-2025 **(contradictorio/no verificado)** [43][44][45] |
| **Backloggd** | 🎮 | Solo web | Gratis; Patreon desde 1 $/mes [49] | No | Sí (feed, listas) | **Sin import Steam ni CSV (en roadmap)** [48] | 650 K registrados fin-2025 (informe con conflicto de interés) [46]; ~9,3 M visitas/mes, España 3,4 % [51] | Sin app nativa (petición n.º 1) [46][48] |
| **GG / HowLongToBeat / Infinite Backlog / Grouvee** | 🎮 | Varía | GG Elite 4,99 $/mes; HLTB gratis con ads; IB free+premium [47] | No | GG sí; HLTB mínimo | HLTB/IB: Steam [47] | n/d | GG criticado por paywall "agresivo"; IB sin app móvil [46][47] |
| **Goodreads** | 📚 | Web, apps | Gratis (Amazon) | Parcial | Sí | CSV | ~94 M tráfico sep-2026 [74] | UI anticuada, review bombing, fuga a StoryGraph tras elecciones EE. UU. 2024 [52][53] |
| **StoryGraph** | 📚 | Web, iOS, Android | Free; Plus 50 $/año (buddy reads/stats avanzadas de pago) [52][53] | No (no verificado) | Sí (buddy reads) | Goodreads CSV | 5 M registros ene-2026 [52] | Sync con Kobo (jun-2026); quejas de lentitud app [52][53] |
| **Hardcover** | 📚 | Web, iOS, Android | Free; Supporter | No | Sí (listas, API) | Goodreads/StoryGraph | 59 K usuarios fin-2025 (+157 %) [55] | Indie; catálogo menor, ediciones faltantes [53] |
| **Fable** | 📚 (+TV) | iOS/Android | Free; Premium ~9–10 $/mes [53] | No | Clubs de lectura | — | n/d | Retiró toda la IA generativa tras resúmenes racistas (ene-2025) [54] |
| **League of Comic Geeks / CLZ** | 🗯 | Web, iOS/Android | LoCG free (Pro/Patron); CLZ suscripción | No | LoCG sí | Barcode | LoCG 380 valoraciones App Store [59] | Nicho coleccionista, pull list |
| **Likewise → Pix Media** | 🎬📺📚 (+podcasts) | Apps | Gratis | No | Sí | — | 8,4 M "suscriptores" (2025) [58] | Tecnología vendida y rebautizada Pix Media (jun-2025) [58] |
| **Tviso (España)** | 🎬📺 | — | — | Sí | — | — | — | **Cerrada 18-07-2019** (heredera de Series.ly) [33] |

---

## 2) Competidores MULTI-FORMATO en detalle

| App | Formatos | Plataforma | Modelo | Import | Social | Observaciones |
|---|---|---|---|---|---|---|
| **Sofa** | 🎬📺📚 podcasts (juegos vía IGDB en matching) | **Solo iOS**; Android "beta pronto" [25][60] | Freemium ("premium de por vida <10 €") [25] | Goodreads, Letterboxd, Trakt, IMDb, TV Time, Hardcover, StoryGraph, CSV [60] | No (organizador personal) | Exporta ZIP de CSV; sin perfiles públicos [60] |
| **Sequel** | 📺🎬📚🎮 | Apple (iOS/iPad/Mac/Vision) [61] | Free + Sequel+ 2,99–174,99 $ [61] | TV Time, Letterboxd, IMDb, Simkl, Goodreads/StoryGraph [61] | No descrito | 1,3 K valoraciones, 4,8★; solo inglés [61] |
| **OnTrack** | 🎬📺📚📖🎮🎌 + juegos de mesa, música, podcasts | iOS [62] | Free + Pro 1,99/17,99 $ [62] | IMDb, RateYourMusic [62] | Sí (seguir, feed, comentarios) | **Español incluido**; 33 valoraciones [62] |
| **allist** | 🎬📺🎌📖📚 | iOS [63] | Free con ads y límite de listas; Premium 1,99 $/mes, 12,99 $/año, 24,99 $ vida [63] | TV Time, Letterboxd, Goodreads, MAL, AniList, IMDb [63] | Compartir listas por enlace | Español incluido; sin valoraciones suficientes [63] |
| **Collective** | 🎬📺🎌📖📚 | iOS [64] | Gratis | No consta | No | 1 valoración [64] |
| **Achriom** | 🎌🎬📺📚 música podcasts 🎮 (sin manga) | Web | Free + Pro 9,99 $/mes [43] | Kitsu | n/d | Marketing SEO agresivo con artículos propios [43][44] |
| **Ryot** (OSS) | 🎬📺🎌📖📚🎮 audiolibros, música, fitness | Self-hosted (Docker) [65] | Gratis + Pro (recomendaciones, perfiles) [65] | Goodreads, Trakt, MAL, Audiobookshelf [65] | Perfiles (Pro) | 3,6 K estrellas GitHub; sin app móvil [65] |
| **Yamtrack / MediaTracker / Watcharr** (OSS) | Yamtrack: 🎬📺🎌🎮📚📖 | Self-hosted [66] | Gratis | CSV Trakt/Letterboxd/Goodreads [66] | No | Yamtrack ~2,5 K★; MediaTracker "desarrollo frenado desde 2025"; IGDB exige cuenta Twitch [66] |
| **Logged / MediaHubly / Calendia / WaLi / Shelf** | 4–5 formatos | Web/iOS | Free | Varía | Algunos | Lanzamientos 2026 en Product Hunt con 1–2 votos [67][68] |
| **Simkl** | 🎬📺🎌 | Multi | Free ilimitado + Pro/VIP | 20+ servicios | Sí | El multi-formato con más tracción, pero sin libros/juegos/cómics [17][18] |
| **Libib / CLZ** | Catálogo (📚🎬🎮🗯) | Web/apps | Freemium | Barcode | No | Son catalogadores de colección física, no trackers sociales |

**Por qué (no) han triunfado — evidencia:**

1. **Nadie ha logrado masa crítica multi-formato.** El único multi-formato con millones de visitas es Simkl (~4 M/mes [72]) y solo cubre vídeo. Los "todo en uno" de 2025-2026 son apps iOS indie con decenas de valoraciones [62][63][64] o lanzamientos Product Hunt con 1–2 votos [67][68].
2. **Dependencia de Apple.** Sofa, Sequel, OnTrack, allist, Collective: iOS. Los OSS (Ryot, Yamtrack) no tienen app móvil y exigen servidor propio [65][66]. No encontré un multi-formato *web gratuito con cuenta y social* comparable a KULTURA fuera de Achriom (de pago) y los OSS.
3. **Economía de "gratis".** TV Time (25 M usuarios) cerró porque "no era sostenible como app gratuita y no había demanda suficiente de una app de pago" [22]. Tviso cerró en 2019 [33]. Kitsu está parada [43][44]. Trakt duplicó precios y recortó el plan gratuito [11][13]. La lección del sector es que el "gratis sin plan de pago" es la excepción que muere, no la norma.
4. **El patrón de abandono.** El informe *State of Game Tracking 2026* (sesgo: su autor vende SavePoint) describe el ciclo "registro → muchos logs la primera semana → abandono", y afirma que sobreviven los que tienen comunidad (Backloggd) o automatización de importación (Infinite Backlog) [46].
5. **La gente usa 2–3 apps y lo acepta.** Guías de 2025 recomiendan Letterboxd + Goodreads + otra sin pedir una app única [47]; en r/kindafunny un grupo busca "una app para todo", y la respuesta es una lista de apps separadas y "no conozco ninguna que lo cubra todo" [69].

---

## 3) Quejas recurrentes por categoría (con enlaces)

**Cine/series**
- Trakt: límite de 100 ítems en free y VIP de 30 → 60 $/año ("low-key predatory", cierre de hilo) [11]; renovaciones legacy a 60 $ (hasta +300 %) [12][13]; rediseño LITE "incompleto", eliminación de listas por defecto "Plan to Watch/On Hold/Dropped" a favor de listas de 100 [14].
- Letterboxd: sin series (debate dividido en r/Letterboxd: unos piden episodios/temporadas, otros rechazan que "ensucie el feed") [8]; "algo más de publicidad" desde 2023 y miedo a *enshittification* por la venta [5]; stats e import CSV solo Pro [3][4].
- TV Time: cierre con 2 semanas de aviso y exportación solo vía formulario RGPD [22][23][25].
- Simkl: interfaz recargada, sin datos de reparto/director, dashboard confuso tras importar 700 títulos [20]; servidores saturados en jul-2026 [23].
- Serializd: episodios faltantes y soporte lento, filtros limitados [27].
- FilmAffinity: no valora series por capítulo [25]; sin exportación oficial, hay que hacer scraping con el perfil en público [31].

**Anime/manga**
- MAL: UI "sin rediseño significativo en una década", anuncios agresivos, compra por una empresa Web3/NFT, API cerrada a terceros en 2018 [37][40][44].
- AniList: comunidad menor que MAL, API limitada a 30 req/min "hasta restaurar" y sin aceptar subidas de cuota [41][44].
- Kitsu: app Android retirada (abr-2024), iOS incierta, "no empieces en Kitsu" [44].

**Videojuegos**
- Backloggd: sin app nativa ("sorely missing an app"), sin import Steam ni exportación (en roadmap), diseño inferior a Letterboxd [46][48][50].
- GG: funciones útiles tras paywall de 4,99 $/mes, "agresivo" [46][47].
- HLTB: social mínimo, anuncios, interfaz inmóvil [47]. Infinite Backlog: sin app, sync "finicky" [47].

**Libros/cómics**
- Goodreads: UI anticuada, búsqueda lenta, review bombing, pertenencia a Amazon [53][54].
- StoryGraph: app móvil por detrás de la web, buddy reads y stats de pago, importaciones fallidas, hilo "slowness and bugs" en r/TheStoryGraph [53].
- Hardcover: catálogo pequeño (no inglés), ediciones faltantes, import con pérdidas [53].
- Fable: resúmenes IA ofensivos → eliminación total de IA generativa (ene-2025) [54].

**Multi-formato**
- Solo iOS (Sofa, Sequel, OnTrack, allist) [25][61][62][63]; sin app móvil ni hosting (Ryot, Yamtrack) [65][66]; anuncios y límites en free (allist) [63]; precios altos para indie (Achriom 9,99 $/mes) [43]; "la mayoría acaba con dos apps" [47].

---

## 4) Huecos reales del mercado (evidencia, no deseos)

1. **Huérfanos de TV Time (jul-2026).** 25 M+ usuarios de una app gratuita, en español, de series+películas, sin sucesor claro; la prensa española recomendó FilmAffinity (sin episodios), Trakt (inglés, 100 ítems) y Simkl [22][25]. Nadie en esa lista es gratis + español + episodios + social.
2. **Expulsados de Trakt (2025-2026).** Precio x2–x4 y plan gratuito de 100 ítems; hilos de migración a Simkl/Letterboxd/Showly [11][12][20][21].
3. **Series en español con episodios.** FilmAffinity domina España (18,7 M visitas/mes desde España [30]) pero no hace episodios ni exporta [25][31]. Serializd lo hace pero en inglés, y aun así España es su 2.º mercado (7,7 %) [28][29]: señal de demanda hispana no servida.
4. **Juegos sin app móvil y sin import.** Backloggd (650 K registrados, no verificable) no tiene app ni import Steam/CSV [46][48]; España es su 5.º país (3,4 %) [51].
5. **Libros fuera de Amazon.** Fuga de Goodreads a StoryGraph (hasta 25 K altas/día en nov-2024; 5 M en ene-2026) [52]; Hardcover crece +157 % en 2025 siendo indie [55]. Ningún líder tiene interfaz en español verificada.
6. **Cómics + manga juntos.** Cómic occidental solo lo cubren catalogadores (LoCG, CLZ) [59]; manga lo cubren apps de anime. No encontré ningún tracker consumer que una cómic + manga + resto. (Hueco real pero **nicho**: 4.530 tebeos comerciales/año en España; GfK atribuye al manga ~75 % de ventas de novedades, dato que Tebeosfera cuestiona [84].)
7. **Portabilidad.** Exportación gratuita y completa es rara (Letterboxd: import solo Pro; Simkl: backup JSON solo VIP; Backloggd: sin export) [3][19][48]. Tras TV Time y Trakt, "mis datos son míos" es argumento de venta demostrado [23][25][60].

**Lo que NO es un hueco:** importar de Letterboxd/MAL/Goodreads (allist, Sequel, Sofa, Simkl lo hacen [60][61][63]); "dónde verlo" (JustWatch, Simkl, Letterboxd lo tienen [34][20]); wrapped anual (Letterboxd, Serializd, Hardcover, StoryGraph [10][28][52][55]); recomendaciones IA (Fable la retiró por daño reputacional [54]; Achriom y Pix la venden [43][58]).

---

## 5) ¿Qué aporta KULTURA? Veredicto en tres niveles

**Nivel "nada nuevo" (la mayoría de funciones, una a una):** estados, progreso, notas, diario, listas, amigos, perfiles públicos, importación, exportación, calendario, "dónde verlo", rankings anuales e IA de recomendación existen todos en algún competidor [18][28][60][61][63]. Las listas colaborativas existen (Simkl VIP, hasta 10 personas [19]); chat y grupos existen en apps de libros (Fable, Goodreads) [53].

**Nivel "combinación nueva" (aquí está el valor real, y es defendible con evidencia):**
- **7 formatos incluyendo manga Y cómic, en web gratuita con social y perfil público.** No encontré ningún competidor consumer que reúna exactamente esto. Los más cercanos son OnTrack/allist (iOS, sin cómic) [62][63], Ryot/Yamtrack (self-hosted, sin social público) [65][66] y Achriom (sin manga, 9,99 $/mes) [43].
- **Español nativo + público España.** De todo el mapa, solo FilmAffinity, SensaCine, JustWatch, OnTrack y allist tienen español verificado [25][32][62][63]; Letterboxd, Trakt, Serializd, Backloggd, MAL, StoryGraph no [4][16][28]. Y FilmAffinity no exporta ni hace episodios [25][31].
- **PWA multiplataforma sin App Store.** Evita el "solo iOS" (Sofa, Sequel, OnTrack, allist) y el "sin móvil" (Backloggd, Ryot, Yamtrack) [25][46][65][66]. Coste: pierde la visibilidad de las tiendas, que es como se descubren casi todas las apps de la tabla.
- **Listas colaborativas + chat + grupos gratis** en un tracker multi-formato: en Simkl la colaboración es VIP [19]; en los multi-formato iOS no existe (no verificado exhaustivamente).
- **Portabilidad total gratis** (JSON import/export) frente a Letterboxd (Pro), Simkl (VIP), Backloggd (nada) [3][19][48].

**Nivel "nuevo de verdad":** ninguna función lo es. Lo único sin precedente localizado es la *suma* (7 formatos + español + gratis sin plan de pago + social + PWA). Honestamente, "gratis sin plan de pago" es también la mayor **debilidad** percibida: el mercado acaba de ver morir a TV Time por exactamente ese modelo [22], Kitsu agoniza [44] y Trakt tuvo que subir precios [13]. Un usuario que migre desde TV Time preguntará "¿y esto cuánto dura?". Hay que responderlo en la landing (costes, plan de sostenibilidad, exportación garantizada).

**Veredicto:** KULTURA es una **combinación nueva** con un hueco concreto y datado (huérfanos de TV Time + expulsados de Trakt + hispanohablantes sin tracker de episodios exportable), no una invención. Su riesgo no es la falta de diferenciación sino (a) demostrar sostenibilidad sin ingresos, (b) la calidad de datos por formato frente a especialistas (queja n.º 1 de Simkl/Hardcover/Kitsu [20][53][40]) y (c) descubrimiento sin tiendas de apps.

---

## 6) Lecciones de crecimiento aplicables a un indie sin presupuesto

| Caso | Hito | Palanca verificable |
|---|---|---|
| **Letterboxd** | 1,8 M (2020) → 10 M (sep-2023) → 30 M (jul-2026); 10 M nuevos en 2025 [1] | Primer empleado a tiempo completo en mar-2020; crecimiento pandémico [7]. TikTok con 570 K seguidores (abr-2024), críticos reclutados de la comunidad, hashtags #LetterboxdFriday / #lastfourwatched [6]. "Four Favorites" con famosos y Year in Review viral (Chainsaw Man n.º 1 de 2025) [2][10]. Mitad de usuarios <35 [2]. |
| **StoryGraph** | 4 M (abr-2025) → 5 M (ene-2026); hasta ~25 K altas/día tras elecciones EE. UU. nov-2024 [52] | Importador de Goodreads + momento de indignación con Amazon + "Reading Wrap-up" anual [52]. Fundadora en solitario con newsletter pública. |
| **Hardcover** | 23 K → 59 K usuarios en 2025 (+157 %) [55] | Hardcover Wrapped; API pública; 22 colaboradores a tiempo parcial. Lección negativa: un post técnico con 60 K vistas "no trajo casi usuarios" [55]. Discord >2.000 miembros [90]. |
| **Backloggd** | 350 K → 650 K registrados en 2025 (fuente con conflicto; metodología no indicada) [46] | Una sola persona, Patreon desde 1 $/mes, roadmap público, comunidad como retención [46][48][49]. |
| **Serializd** | 10 K+ DAU (2023) [27]; 2,2 K valoraciones App Store; España 2.º país [28][29] | Nicho que Letterboxd no cubre (episodios), moderación cercana, "Rewatch" anual, votaciones Emmy, traducciones FR/IT [27][28]. |
| **Simkl** | Picos de altas cuando Trakt limita (ene-2025) y TV Time cierra (jul-2026) [20][23] | Importadores de un clic y páginas "Simkl vs X" indexadas en Google [17]. |

**Aplicación a KULTURA (sin dinero):**
1. **Importadores como arma de captación**, no como función: páginas "Vengo de TV Time / Trakt / FilmAffinity" indexables, como hace Simkl [17]. El de FilmAffinity (hoy inexistente en el mercado salvo scrapers [31]) sería único en España.
2. **Wrapped anual compartible** multi-formato (todas las apps que crecen lo tienen [10][28][52][55]).
3. **Comunidades hispanas existentes**: Discord "Club de Anime y Manga en Español" (18,8 K miembros [87]), BookTok España (6,3 M libros vendidos por BookTok en 2025, 116,6 M € [85]), r/Simkl y r/trakt para migrantes [20][21]. Evidencia de que escribir posts técnicos no capta usuarios [55]; la comunidad y los momentos de migración sí [20][52].
4. **Roadmap público + Patreon/donaciones** (Backloggd, Hardcover) como respuesta a "¿cuánto dura esto?" [49][55]; compatible con MangaDex y RAWG (donaciones permitidas) [77][79].
5. **Una cosa mejor que nadie** antes de 7 cosas regular: Serializd creció haciendo solo episodios [27]; la queja n.º 1 de los multi-formato es "datos pobres por formato" [20][53].

---

## 7) Riesgos de datos y licencias (estado comprobado nov-2026)

| Fuente | Condición clave | Riesgo para KULTURA |
|---|---|---|
| **TMDB** | Gratis solo para uso **no comercial** con logo + aviso "This product uses the TMDB API but is not endorsed or certified by TMDB" y enlace; comercial = contactar ventas [75] | Bajo mientras no haya ingresos. Donaciones: zona gris ("propósito principal generar ingresos") [75]. Verificar que la atribución esté visible. |
| **JustWatch (vía TMDB watch providers)** | "Debes atribuir la fuente como JustWatch"; sin deep links; incumplir = revocación de la API TMDB [76] | **Alto si falta la atribución**: perder TMDB tumba cine y series. |
| **RAWG** | Free 20.000 req/mes, **backlink activo en cada página** con datos; comercial gratis <100 K MAU / 500 K PV; Business 149 $/mes; prohibido redistribuir [77]. Monetizando la API; "la API gratis no se va pronto" (post sin año) [78] | Medio: límite mensual bajo sin caché; mantenimiento del dataset **no verificado** (no encontré changelog 2025-2026). Alternativa IGDB exige cuenta Twitch [66] (docs IGDB no accesibles en esta sesión: **no verificado**). |
| **AniList** | 90 req/min estándar, **30 req/min en estado degradado actual**, no aceptan subidas de cuota; sin cláusula comercial en esa página [41] | Medio: cachear agresivamente; sin cuota extra posible. |
| **MangaDex** | Debes acreditar a MangaDex; **prohibidos anuncios y servicios de pago** (donaciones OK); ~5 req/s; imágenes y CORS deben pasar por tu proxy; cortan "aunque técnicamente no incumplas" [79] | Medio: hoy compatible; **cualquier monetización futura (ads, premium) rompe la licencia**. |
| **ComicVine** | 200 req/recurso/hora; "**estrictamente no comercial**"; enlace de vuelta en cada página con datos; clave por sitio [80] | Igual que MangaDex: bloquea monetización y limita velocidad. |
| **Open Library** | 1 req/s anónimo, 3 req/s con User-Agent + email; prohibido bulk vía API [81] | Bajo; identificar la app. |
| **Hardcover API** (si se añade) | Token personal, 60 req/min, expira cada año, beta [56] | Bajo; no apto para backend compartido sin acuerdo. |
| **Importación de FilmAffinity** | Sin API ni exportación oficial; solo scraping de perfil público [31] | Legal/técnico: scraping sin permiso **no verificado** frente a sus términos. |

**Síntesis:** el stack actual es legal **solo** mientras KULTURA sea no comercial y sin anuncios. El día que necesite ingresos (lo que mató a TV Time) tendrá que: licenciar TMDB, pagar RAWG Business, y **sustituir ComicVine y MangaDex** o convertir esos formatos en entrada manual. Conviene planificarlo ahora (p. ej., donaciones, que MangaDex y RAWG permiten explícitamente [77][79]).

---

## 8) Fuentes (URL + fecha de la fuente; consulta 05-11-2026)

1. Wikipedia, "Letterboxd" — https://en.wikipedia.org/wiki/Letterboxd (cifras 2020–jul-2026)
2. Forbes Argentina, "La batalla por Letterboxd…" — https://www.forbesargentina.com/negocios/la-batalla-letterboxd-plataforma-culto-convirtio-activo-us-250-millones-n97776/amp (2026, sin día)
3. Letterboxd, "Paid subscriptions" — https://letterboxd.com/about/pro/
4. App Store España, Letterboxd — https://apps.apple.com/es/app/id1054271011
5. Xataka, "Letterboxd era uno de los últimos reductos…" — https://www.xataka.com/cine-y-tv/letterboxd-red-social-cinefila-esta-venta-sus-usuarios-se-han-echado-a-temblar-porque-saben-como-suele-acabar-esto (28-04-2026)
6. YouScan, "How Letterboxd is reshaping film culture" — https://youscan.io/blog/how-letterboxd-is-reshaping-film-culture/ (28-04-2024, act. 27-01-2026)
7. Variety vía Yahoo, "Letterboxd Founders on Selling…" — https://ca.news.yahoo.com/letterboxd-founders-selling-company-expanding-162814542.html (05-10-2023)
8. r/Letterboxd, "TV update from the Letterboxd feedback form" — https://redlib.belloworld.it/r/Letterboxd/comments/1fjwynk/tv_update_from_the_letterboxd_feedback_form (2024, fecha relativa)
9. MacStories, "Letterboxd Reveals Details of New Video Store…" — https://www.macstories.net/news/letterboxd-reveals-details-of-new-video-store-available-december-10-on-web-ios-tvos-and-more/ (nov-2025)
10. GamesRadar, "Anime reigns supreme on Letterboxd…" — https://www.gamesradar.com/entertainment/anime-movies/anime-reigns-supreme-on-letterboxd-as-chainsaw-man-the-movie-reze-arc-is-crowned-last-years-highest-rated-movie/ (13-01-2026)
11. AlternativeTo, "Trakt.tv has set stricter limits…" — https://alternativeto.net/news/2025/2/trakt-tv-has-set-stricter-limits-for-free-users-and-raised-vip-subscription-prices-by-100-/ (feb-2025)
12. AlternativeTo, "Trakt announces all VIP renewals…" — https://alternativeto.net/news/2025/5/trakt-announces-all-vip-renewals-will-switch-to-a-new-standard-rate-doubling-prices (may-2025)
13. Neowin, "Trakt VIP receives up to 300% price hike…" — https://www.neowin.net/amp/trakt-vip-receives-up-to-300-price-hike-going-back-on-promise-to-honor-legacy-subs/ (13/18-05-2025)
14. AlternativeTo, "Trakt unveils a full redesign…" — https://alternativeto.net/news/2025/11/trakt-unveils-a-full-redesign-of-its-movie-and-tv-tracking-platform-for-web-and-mobile/ (nov-2025)
15. Trakt Forums (cerrado, "Moved 2026") — https://forums.trakt.tv/t/updating-trakt-limits-for-2026/101592
16. App Store EE. UU., Trakt — https://apps.apple.com/us/app/-/id1514873602
17. Simkl Docs, "SIMKL vs Trakt" — https://docs.simkl.org/how-to-use-simkl/faq/frequently-asked-questions/simkl-alternatives/simkl-vs-trakt (sin fecha; cita cambios 2026)
18. Simkl Docs, plan Free — https://docs.simkl.org/how-to-use-simkl/account-and-billing/subscription-plans/free
19. Simkl Docs, plan VIP — https://docs.simkl.org/how-to-use-simkl/account-and-billing/subscription-plans/vip
20. r/Simkl, "SIMKL has a big opportunity now" — https://reddit.birdcat.cafe/r/Simkl/comments/1i91thj/simkl_has_a_big_opportunity_now (24-01-2025)
21. r/Simkl, "Coming from Trakt…" — https://redlib.ssps.io/r/Simkl/comments/1ko10h5/coming_from_trakt_looking_to_understand_whats (16-05-2025)
22. TechCrunch, S. Perez, TV Time shutting down — https://techcrunch.com/?p=3138586 (02-07-2026)
23. MacRumors, "Popular Show Tracking App TV Time Shutting Down" — https://macrumors.com/2026/07/02/show-tracking-app-tv-time-shutting-down (02-07-2026)
24. Wikipedia, "TV Time" — https://en.wikipedia.org/wiki/TV_Time
25. Xataka, "Alternativas a TV Time…" — https://www.xataka.com/basics/alternativas-a-tv-time-mejores-aplicaciones-para-usar-su-lugar-como-descargarte-tus-datos-series-peliculas (02-07-2026)
26. Moviebase (autor interesado), "TV Time alternatives" — https://moviebase.app/resources/tv-time-alternatives (rev. 13-09-2026)
27. Product Hunt, reseñas Serializd — https://www.producthunt.com/products/serializd/reviews (2023)
28. App Store EE. UU., Serializd — https://apps.apple.com/us/app/id1581244120?l=en-us
29. Similarweb, serializd.com — https://www.similarweb.com/website/serializd.com/ (sep-2026)
30. Semrush, filmaffinity.com — https://www.semrush.com/website/filmaffinity.com/overview/ (sep-2026, act. 11-10-2026)
31. Androidphoria, "Expórtalo a Letterboxd…" — https://androidphoria.com/tutoriales/como-exportar-filmaffinity-a-letterboxd (21-03-2026)
32. SensaCine, "Servicios" — https://www.sensacine.com/servicios/
33. Genbeta, etiqueta Tviso (cierre) — https://www.genbeta.com/tag/tviso (18-07-2019)
34. Wikipedia, "JustWatch" — https://en.wikipedia.org/wiki/JustWatch (datos nov-2023)
35. Semrush, justwatch.com competitors — https://www.semrush.com/website/justwatch.com/competitors/ (sep-2026)
36. Plex, "Important 2025 Plex updates" — https://www.plex.tv/blog/important-2025-plex-updates/ (19-03-2025)
37. Wikipedia, "MyAnimeList" — https://en.wikipedia.org/wiki/MyAnimeList
38. MyAnimeList Co., "About" — https://about.myanimelist.net/about (act. 22-06-2026)
39. Anitrendz, "MyAnimeList To Be Sold to Web3 Startup Gaudiy" — https://www.anitrendz.com/news/2025/04/01/myanimelist-to-be-sold-to-web3-startup-gaudiy (01-04-2025)
40. dev.to (sesgo AniTroves), "MyAnimeList is showing its age" — https://dev.to/has_tag/myanimelist-is-showing-its-age-here-are-the-platforms-that-have-moved-on-2id9 (07-05-2025)
41. AniList Docs, "Rate limiting" — https://docs.anilist.co/guide/rate-limiting
42. Semrush, anilist.co — https://www.semrush.com/website/anilist.co/overview/ (sep-2026)
43. Achriom (sesgo), "Kitsu Alternatives 2026" — https://www.achriom.com/blog/best-kitsu-alternatives/ (04-11-2026)
44. Achriom (sesgo), "Best Anime Tracking Apps (2026)" — https://www.achriom.com/blog/best-anime-tracking-apps/ (05-04-2026)
45. Mirror no oficial que anuncia "Kitsu will be shut down on Nov. 11, 2025" — https://scriptagc.wasmer.app/https_kitsu_life (**no verificado**; contradice [43])
46. Two Average Gamers (sesgo SavePoint), "State of Game Tracking 2026" — https://www.twoaveragegamers.com/state-of-game-tracking-2026-the-complete-industry-report/ (25-02-2026, act. 27-10-2026)
47. Two Average Gamers, "Best Letterboxd alternatives for gamers…" — https://www.twoaveragegamers.com/best-letterboxd-alternatives-for-gamers-who-track-everything-2026/ (09-02-2026, act. 19-10-2026)
48. Backloggd, Roadmap — https://backloggd.com/roadmap/
49. Patreon, Backloggd — https://www.patreon.com/backloggd
50. Tildes, "Recommendation for a Goodreads for video games?" — https://tildes.net/~games/1h9d/recommendation_for_a_goodreads_for_video_games (26-06-2024)
51. Semrush, backloggd.com — https://www.semrush.com/website/backloggd.com/overview/ (sep-2026)
52. Wikipedia, "The StoryGraph" — https://en.wikipedia.org/wiki/The_StoryGraph
53. Unstar.app (sesgo), "5 Reading Trackers Ranked (2026)" — https://unstar.app/blog/goodreads-storygraph-fable-hardcover-bookly-reading-tracker-apps-ranked-2026 (29-05-2026)
54. Book Riot, "…These Apps Are Getting Controversial" — https://bookriot.com/?p=587537 (14-01-2025)
55. Adam Fortuna, "2025 year in review" — https://adamfortuna-com.pages.dev/2025-year-in-review
56. Hardcover Docs, API Getting Started — https://docs.hardcover.app/api/getting-started/ (21-07-2025)
57. Semrush, hardcover.app — https://www.semrush.com/website/hardcover.app/overview/ (ago-2026)
58. Wikipedia, "Likewise, Inc." — https://en.wikipedia.org/wiki/Likewise,_Inc. (Pix Media, jun/dic-2025)
59. App Store, Comic Geeks — https://apps.apple.com/ca/app/comic-geeks/id874775221
60. Sofa blog, "Import Your Library, Take It With You" — https://www.sofahq.com/blog/import-your-library-take-it-with-you (28-05-2026)
61. App Store, Sequel — https://apps.apple.com/app/sequel/id1630746993
62. App Store, OnTrack — https://apps.apple.com/us/app/id6742569453
63. App Store, allist — https://apps.apple.com/us/app/id6762418164
64. App Store, Collective — https://apps.apple.com/app/id6759681025
65. GitHub, IgnisDa/ryot — https://github.com/IgnisDa/ryot
66. Pistack, "Yamtrack vs MediaTracker vs Movary (2026)" — https://www.pistack.xyz/posts/yamtrack-vs-mediatracker-vs-movary-self-hosted-media-tracker-guide-2026/ (19-04-2026)
67. Product Hunt, Logged — https://www.producthunt.com/p/logged/logged (≈mid-2026)
68. Product Hunt, MediaHubly — https://www.producthunt.com/products/mediahubly (2026)
69. r/kindafunny, "Catalog apps for games or multimedia" — https://lr.sudovanilla.org/r/kindafunny/comments/1gtj2et/catalog_apps_for_games_or_multimedia (nov-2024)
70. Semrush, letterboxd.com — https://www.semrush.com/website/letterboxd.com/overview/ (sep-2026)
71. Semrush, trakt.tv — https://www.semrush.com/website/trakt.tv/overview/ (sep-2026)
72. Semrush, simkl.com — https://www.semrush.com/website/simkl.com/overview/ (sep-2026)
73. Semrush, myanimelist.net — https://www.semrush.com/website/myanimelist.net/overview/ (sep-2026)
74. Semrush, goodreads.com — https://www.semrush.com/website/goodreads.com/overview/ (sep-2026)
75. TMDB Developer FAQ — https://developer.themoviedb.org/docs/faq (mod. 07-10-2025)
76. TMDB Developer, Movie Watch Providers (nota JustWatch) — https://developer.themoviedb.org/reference/movie-watch-providers
77. RAWG API docs — https://rawg.io/apidocs
78. RAWG en Medium, "Don't Lose Your Access to RAWG API" — https://medium.com/rawg/dont-lose-your-access-to-rawg-api-df46eca95090 (sin año)
79. MangaDex API docs — https://api.mangadex.org/docs/ y https://api.mangadex.org/docs/2-limitations
80. Comic Vine API — https://comicvine.gamespot.com/api/
81. Open Library Developers API — https://openlibrary.org/developers/api (ed. 30-10-2026)
82. Vozpópuli (AEVI Anuario 2025) — https://www.vozpopuli.com/altavoz/cultura/espana-ya-juega-en-todas-partes-el-videojuego-reune-a-23-millones-de-personas-y-supera-los-2200-millones-de-euros-de-negocio.html (03-08-2026): 22,8 M jugadores, 2.293 M €
83. La Moncloa, Barómetro de Hábitos de Lectura 2025 — https://www.lamoncloa.gob.es/serviciosdeprensa/notasprensa/cultura/Paginas/2026/220126-crece-la-lectura-como-ocio.aspx (22-01-2026): 66,2 % lee en tiempo libre; 76,9 % entre 15–24
84. Tebeosfera, Informe 2024 — https://tebeosfera.com/anexos/informe_tebeosfera_2024.pdf
85. TikTok Newsroom, BookTok España 2025 — https://newsroom.tiktok.com/el-fenmeno-booktok-impulsa-la-venta-de-libros-en-espaa-generando-ms-de-116-millones-de-euros-en-2025?lang=es (20-04-2026; datos Media Control/NielsenIQ)
86. Vozpópuli, anime/manga en España — https://www.vozpopuli.com/altavoz/cultura/como-el-anime-el-manga-y-los-videojuegos-han-conquistado-espana-y-por-que-no-son-solo-entretenimiento.html (18-02-2026; ">60 % de 16–34 ve anime" **sin fuente: no verificado**)
87. Discord, "Club de Anime y Manga en Español" — https://discord.com/servers/club-de-anime-y-manga-en-espanol-758717909521924107 (18.811 miembros a 05-11-2026)
88. KULTURA — https://kulturaapp.vercel.app (visita 05-11-2026)
89. Hardcover blog, informe junio 2025 — https://static.hardcover.app/blog/hardcover-report-for-june-2025
90. (= 89) Discord Hardcover >2.000 miembros
91. tuapppara.com, apps para organizar series (ES) — https://tuapppara.com/aplicaciones/android/organizar-series-peliculas/ (rev. 08-09-2026)

**No encontrado / no verificado en esta sesión:** cifras de usuarios de AniList, Simkl, Serializd, Sofa, Hobi, Taste.io, Kinorium, Reelgood, Stashd, Marvin, Kimu, Culture Pass, Oku, Literal, Bookmory, MangaUpdates; idioma español de Simkl/StoryGraph/Goodreads; estado de la API de IGDB (docs inaccesibles); fecha exacta del post de RAWG; mantenimiento del dataset RAWG; precios de Letterboxd Pro/Patron fuera de España; límites free de Simkl por lista en plan Free (solo constan Pro: 2.000/60.000 y VIP: 10.000/500.000).
