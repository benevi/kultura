# Correos a proveedores · borradores (8A.0 tarea 5)

Plantilla: `docs/fase8/plantillas/correo-proveedor-portadas.md`. Datos: `docs/legal/hoy-inventario.md` y `docs/legal/terminos/README.md`.
**Los envía Víctor**, desde `kultura.app.contacto@gmail.com`. Las respuestas se guardan en `docs/legal/respuestas/<proveedor>-AAAA-MM-DD.md` y su ruta va a `provider_art_policy.evidence_path` (8A.2).

Van en inglés: son proveedores internacionales. Hay un cuerpo común y, por proveedor, el destinatario y los puntos que cambian.

## Decisiones de Víctor (17-11-2026)

- **A. Copia de la landing:** se cuenta (punto 2b) a TMDB, Steam y MangaDex. Es la copia propia recortada y con mapa de profundidad del bucket `landing` y de `public/landing/fallback/` (tarea pausada, #175).
- **B. AniList:** se le pregunta directamente (punto 6) si KULTURA cae en su prohibición de *trackers* de anime y manga.
- **C. MyAnimeList:** no se le escribe hasta decidir si se pasa a su API oficial, que obliga a avisarles al publicar (§4(b)). A Jikan se le escribe solo por cortesía.
- **D. Destinatarios:** los marcados «[confirmar]» los busca Víctor en la web de contacto de cada proveedor antes de enviar.

## Cuerpo común

> **Subject:** KULTURA – question about how we display [Provider] cover images
>
> Hello [Provider] team,
>
> I'm Víctor, the person behind KULTURA (https://kulturaapp.vercel.app), a personal, **non-commercial** project: no revenue, no ads, no subscriptions. People use it to keep track of what they watch, read and play. It has fewer than 10 registered users. We use your API under your terms and credit you as follows: [attribution].
>
> We'd like written confirmation that the way we use your cover images is acceptable:
>
> 1. **Display:** covers are shown by linking directly to your CDN ([hosts]).
> 2. **Image optimizer:** [optimizer paragraph]
> 2b. [only if it applies: landing copy paragraph]
> 3. **Link previews (Open Graph):** when someone shares a title page, the server generates a preview image that may include its cover.
> 4. **Planned 3D view:** the same cover, loaded directly from your CDN by the user's browser, shown as a texture. No copy on our servers.
> 5. **Future, only with your explicit permission:** may we store our own compressed copy (e.g. KTX2) or derivatives such as a depth map?
> [6. provider-specific question]
>
> If any of these uses is not acceptable, we will stop it and remove what is affected within 7 days. We'd also be glad to use the attribution wording you prefer.
>
> Thank you,
> Víctor · KULTURA · kultura.app.contacto@gmail.com

**Optimizer paragraph** (texto que va en «[optimizer paragraph]», según el proveedor):
- **Directo:** «We don't pass your images through any proxy or cache: browsers load them directly from your CDN.»
- **Parcial:** «Some covers go through our host's image service (Vercel), which resizes them and keeps a temporary cached copy (at least 7 days, longer if your cache headers allow it).»
- **Siempre:** «All of your covers go through our host's image service (Vercel), which resizes them and keeps a temporary cached copy (at least 7 days, longer if your cache headers allow it).»

**Landing copy paragraph (2b):** «Our public landing page also shows a small set of [N] covers that we cropped, re-encoded and stored ourselves, together with a computed depth map, for a 3D effect. We have paused this and won't add more without your permission. If you prefer, we'll delete them.»

## Por proveedor

| Proveedor | Para | [hosts] | [attribution] | Optimizador | 2b | 6 · pregunta propia |
|---|---|---|---|---|---|---|
| TMDB | [confirmar] (themoviedb.org/contact o foro de la API) | image.tmdb.org | TMDB logo and the notice "This product uses the TMDB API but is not endorsed or certified by TMDB" in every page footer | Directo (salvo la galería 3D de la landing: «Parcial») | Sí | Does a server-generated link preview that includes a poster count as a "derivative work" under §1.C? |
| RAWG | [confirmar] (rawg.io, contacto de la API) | media.rawg.io | "Data from RAWG" with an active link in every page footer | Directo | No | — |
| ComicVine | [confirmar] (foro de la API de Comic Vine) | comicvine.gamespot.com | "Comic Vine" in every page footer (we will add the link) | Siempre | No | — |
| AniList | contact@anilist.co | s4.anilist.co | "AniList" in every page footer | Parcial (página `/best`) | No | Your terms exclude competing anime/manga tracking services. KULTURA tracks films, books, games, comics, anime and manga, and only reads public title data (titles, covers, genres), never AniList user data. Is this use acceptable? |
| MangaDex | [confirmar] (Discord o soporte de mangadex.org) | uploads.mangadex.org (covers, 256/512 thumbnails) | "MangaDex" in every page footer | Siempre (es el proxy que pide su política) | Sí | Is routing covers through our host's image service an acceptable proxy under your hotlinking policy? |
| Jikan (cortesía) | [confirmar] (GitHub jikan-me) | cdn.myanimelist.net | "MyAnimeList" in every page footer | Parcial | No | Only to let you know we use Jikan, and to ask whether you prefer specific attribution. |
| Open Library | [confirmar] (openlibrary.org/contact) | covers.openlibrary.org | "Open Library" in every page footer | Directo | No | — |
| Google Books | [confirmar] (vía de contacto de la Books API) | books.google.com | "Google Books" in every page footer | Directo | No | We'll add the "Powered by Google" logo and a link per book: is that enough? |
| Steam / Valve | [confirmar] (no usar webapi@valvesoftware.com: es para denunciar abusos) | *.steamstatic.com | "Steam" link plus the Valve trademark notice | Siempre (capturas y landing) | Sí | We read game details from store.steampowered.com/api/appdetails. Is that covered by the Steam Web API terms? |
| JustWatch | [confirmar] (justwatch.com, contacto de *partners*) | — (no hay portadas; datos vía TMDB) | "Availability according to JustWatch, via TMDB", with a link | — | No | Correo corto: ¿basta la atribución con texto y enlace, o preferís el logo? (sin los puntos 1–5) |
