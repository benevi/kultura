/**
 * Catálogo con PORTADAS REALES para las capturas de diseño (solo pruebas).
 *
 * Las imágenes de esta carpeta son portadas de catálogo descargadas de sus
 * proveedores (TMDB, AniList, Open Library, MangaDex, Comic Vine, Steam) y de
 * los rankings de producción, para ver las pantallas con su contenido de
 * verdad sin red. Se activa con `E2E_COVERS=1` (lo pone `.bunshin/shoot.cjs`
 * o quien arranque el servidor offline); sin la variable, la red de seguridad
 * de accesibilidad sigue con sus datos de siempre.
 *
 * - `fixtures.cjs` usa CATALOGUE para TMDB y para las tablas `media`,
 *   `user_media` y `list_items` del Supabase simulado;
 * - `coverFileFor(url)` dice qué archivo local sirve una URL de portada
 *   (directa al CDN o a través de `/_next/image`); lo usa `routeCovers` para
 *   interceptar las peticiones de imagen del navegador. No se toca ningún
 *   camino de producción: la app pide sus URLs de siempre.
 */
const fs = require("node:fs");
const path = require("node:path");

const DIR = __dirname;

/**
 * type, externalId, title, year, rating (0-10, null si el proveedor no da
 * nota), poster (URL de origen) y file (archivo local). Las 8 `best_*` son
 * portadas del ranking de películas de 2025 de producción, sin título
 * conocido: se rotulan como tales.
 */
const CATALOGUE = [
  { type: "movie", externalId: "155", title: "El caballero oscuro", year: 2008, rating: 8.539, poster: "https://image.tmdb.org/t/p/w500/8QDQExnfNFOtabLDKqfDQuHDsIg.jpg", file: "movie_155.jpg" },
  { type: "movie", externalId: "969681", title: "Spider-Man: Brand New Day", year: 2026, rating: 8.486, poster: "https://image.tmdb.org/t/p/w500/9g0sEFhmvmK4nGhXj8DHuv2noYI.jpg", file: "movie_969681.jpg" },
  { type: "movie", externalId: "1596275", title: "Drive: Los farsantes", year: 2026, rating: 7.737, poster: "https://image.tmdb.org/t/p/w500/aSvA1Xat045jh8ck7U626PPkzH1.jpg", file: "movie_1596275.jpg" },
  { type: "tv", externalId: "2316", title: "The Office", year: 2005, rating: 8.6, poster: "https://image.tmdb.org/t/p/w500/5uwetbr0X8BPRy3Wmh63S9EhsiY.jpg", file: "tv_2316.jpg" },
  { type: "tv", externalId: "1100", title: "Cómo conocí a vuestra madre", year: 2005, rating: 8.111, poster: "https://image.tmdb.org/t/p/w500/82DxDd43B7F1JunSlbZ7vkWFgej.jpg", file: "tv_1100.jpg" },
  { type: "anime", externalId: "al-11061", title: "Hunter x Hunter (2011)", year: 2011, rating: 8.9, poster: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx11061-y5gsT1hoHuHw.png", file: "anime_al_11061.jpg" },
  { type: "anime", externalId: "al-16498", title: "Attack on Titan", year: 2013, rating: 8.5, poster: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx16498-buvcRTBx4NSm.jpg", file: "anime_al_16498.jpg" },
  { type: "anime", externalId: "al-113415", title: "JUJUTSU KAISEN", year: 2020, rating: 8.4, poster: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx113415-LHBAeoZDIsnF.jpg", file: "anime_al_113415.jpg" },
  { type: "book", externalId: "OL450063W", title: "Frankenstein; or, The Modern Prometheus", year: 1818, rating: null, poster: "https://covers.openlibrary.org/b/id/12356249-L.jpg", file: "book_OL450063W.jpg" },
  { type: "book", externalId: "OL8193416W", title: "The Picture of Dorian Gray", year: 1890, rating: null, poster: "https://covers.openlibrary.org/b/id/14314858-L.jpg", file: "book_OL8193416W.jpg" },
  { type: "manga", externalId: "a77742b1-befd-49a4-bff5-1ad4e6b0ef7b", title: "Chainsaw Man", year: 2018, rating: null, poster: "https://uploads.mangadex.org/covers/a77742b1-befd-49a4-bff5-1ad4e6b0ef7b/6e518bd1-5f60-446b-8832-bfe6bf74834b.jpg", file: "manga_a77742b1_befd_49a4_bff5_1ad4e6b0ef7b.jpg" },
  { type: "manga", externalId: "b0b721ff-c388-4486-aa0f-c2b0bb321512", title: "Sousou no Frieren", year: 2020, rating: null, poster: "https://uploads.mangadex.org/covers/b0b721ff-c388-4486-aa0f-c2b0bb321512/b9a049b0-186b-4714-a83e-bb965458914a.jpg", file: "manga_b0b721ff_c388_4486_aa0f_c2b0bb321512.jpg" },
  { type: "comic", externalId: "1197234", title: "Black Star #4", year: 2026, rating: null, poster: "https://comicvine.gamespot.com/a/uploads/scale_medium/11161/111615891/10217335-cover.jpg", file: "comic_1197234.jpg" },
  // Juegos: id de Steam de la portada (413150, 1086940, 1145350).
  { type: "game", externalId: "413150", title: "Stardew Valley", year: 2016, rating: null, poster: "https://media.rawg.io/media/games/kultura-fixture/game_413150.jpg", file: "game_413150.jpg" },
  { type: "game", externalId: "1086940", title: "Baldur's Gate 3", year: 2023, rating: null, poster: "https://media.rawg.io/media/games/kultura-fixture/game_1086940.jpg", file: "game_1086940.jpg" },
  { type: "game", externalId: "1145350", title: "Hades II", year: 2025, rating: null, poster: "https://media.rawg.io/media/games/kultura-fixture/game_1145350.jpg", file: "game_1145350.jpg" },
  ...Array.from({ length: 8 }, (_, i) => ({
    type: "movie",
    externalId: String(9_100_001 + i),
    title: `Ranking de cine 2025 · n.º ${i + 1}`,
    year: 2025,
    rating: Math.round((8.4 - i * 0.12) * 1000) / 1000,
    poster: `https://image.tmdb.org/t/p/w500/kultura-best_${i + 1}.jpg`,
    file: `best_${i + 1}.jpg`,
  })),
];

const mediaId = (c) => `${c.type}_${c.externalId}`;

/** Último tramo de la ruta, sin los sufijos de tamaño de los CDN. */
function key(u) {
  let p;
  try {
    p = new URL(u).pathname;
  } catch {
    return null;
  }
  const base = decodeURIComponent(p.split("/").pop() || "");
  return base
    .replace(/\.(256|512)\.jpg$/, "")
    .replace(/-(S|M|L)\.jpg$/, "")
    .replace(/\.(png|jpe?g|webp)$/i, "");
}

const BY_KEY = new Map(CATALOGUE.map((c) => [key(c.poster), c.file]));

/**
 * Archivo local de una URL de portada, o null. Entiende la URL directa al
 * CDN (cualquier ancho de TMDB/RAWG, -M/-L de Open Library, .256/.512 de
 * MangaDex) y el optimizador de Next (`/_next/image?url=…`).
 */
function coverFileFor(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.pathname === "/_next/image" && u.searchParams.get("url")) return coverFileFor(u.searchParams.get("url"));
  const file = BY_KEY.get(key(url));
  return file ? path.join(DIR, file) : null;
}

/**
 * Playwright: sirve las portadas desde esta carpeta (en un `page` o un
 * `context`). Lo que no es una portada conocida sigue su camino.
 */
async function routeCovers(target) {
  await target.route(
    (url) => coverFileFor(url.href) !== null,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "image/jpeg",
        headers: { "cache-control": "public, max-age=31536000, immutable" },
        body: fs.readFileSync(coverFileFor(route.request().url())),
      })
  );
}

module.exports = { CATALOGUE, mediaId, coverFileFor, routeCovers, COVERS_DIR: DIR };
