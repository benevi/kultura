/**
 * Datos fijos de la red de seguridad de accesibilidad (ACC-18).
 *
 * El job de CI no llama a ningún proveedor ni a Supabase de verdad:
 * - `offline-fetch.cjs` responde en el propio proceso de Next a TMDB (y
 *   devuelve 503 al resto de proveedores, que la app ya trata como caídos);
 * - `mock-supabase.mjs` hace de Supabase (auth + PostgREST) en localhost.
 * Así cada ejecución pinta exactamente lo mismo y no hay flakes de red.
 */

/**
 * `E2E_COVERS=1`: catálogo con portadas reales (`tests/e2e/fixtures/covers`)
 * para las capturas de diseño. Sin la variable, los datos de siempre.
 */
const COVERS = process.env.E2E_COVERS === "1";
const covers = COVERS ? require("../fixtures/covers/catalogue.cjs") : null;

const USER_ID = "00000000-0000-4000-8000-000000000001";
const FRIEND_ID = "00000000-0000-4000-8000-000000000002";
const LIST_ID = "00000000-0000-4000-8000-0000000000a1";
const GROUP_ID = "00000000-0000-4000-8000-0000000000b1";
const CONVERSATION_ID = "00000000-0000-4000-8000-0000000000c1";
const NOW = "2026-10-01T10:00:00.000Z";

const user = {
  id: USER_ID,
  email: "a11y@example.com",
  username: "a11y_tester",
  avatar_color: "blue",
  avatar_initials: "AT",
  avatar_icon: null,
  bio: null,
  preferred_locale: "es",
  library_visibility: "friends",
  onboarded_at: NOW,
  created_at: NOW,
  updated_at: NOW,
};

const friend = {
  ...user,
  id: FRIEND_ID,
  email: "friend@example.com",
  username: "lucia_lee",
  avatar_color: "purple",
  avatar_initials: "LL",
};

/** Usuario público de `/u/benevi` (perfil y colección públicos). */
const benevi = {
  ...user,
  id: "00000000-0000-4000-8000-000000000003",
  email: "benevi@example.com",
  username: "benevi",
  avatar_color: "orange",
  avatar_initials: "BE",
  library_visibility: "public",
};

const MOVIES = [
  { id: 550, title: "El club de la lucha", year: 1999 },
  { id: 603, title: "Matrix", year: 1999 },
  { id: 27205, title: "Origen", year: 2010 },
  { id: 157336, title: "Interstellar", year: 2014 },
  { id: 680, title: "Pulp Fiction", year: 1994 },
  { id: 13, title: "Forrest Gump", year: 1994 },
  { id: 238, title: "El padrino", year: 1972 },
  { id: 424, title: "La lista de Schindler", year: 1993 },
];

function tmdbMovie(m, i) {
  return {
    id: m.id,
    title: m.title,
    original_title: m.title,
    name: m.title,
    original_name: m.title,
    overview: `Sinopsis de prueba de ${m.title}.`,
    // Sin portada real: la app pinta su gradiente y las peticiones de imagen
    // las corta el test igualmente.
    poster_path: `/a11y-${m.id}.jpg`,
    backdrop_path: `/a11y-${m.id}-b.jpg`,
    release_date: `${m.year}-06-15`,
    first_air_date: `${m.year}-06-15`,
    vote_average: 8.4 - i * 0.1,
    vote_count: 20000 - i * 100,
    popularity: 100 - i,
    genre_ids: [18, 53],
    original_language: "en",
    adult: false,
    media_type: "movie",
  };
}

/** Modo portadas: las películas y series del catálogo, con su ruta de TMDB. */
function coverTmdb(c, i) {
  const posterPath = new URL(c.poster).pathname.replace(/^\/t\/p\/[^/]+/, "");
  const base = tmdbMovie({ id: Number(c.externalId), title: c.title, year: c.year }, i);
  return {
    ...base,
    poster_path: posterPath,
    backdrop_path: null,
    vote_average: c.rating ?? base.vote_average,
    media_type: c.type,
  };
}
const COVER_MOVIES = COVERS ? covers.CATALOGUE.filter((c) => c.type === "movie").map(coverTmdb) : [];
const COVER_TV = COVERS ? covers.CATALOGUE.filter((c) => c.type === "tv").map(coverTmdb) : [];

const tmdbResults = COVERS ? COVER_MOVIES : MOVIES.map(tmdbMovie);
/** Listados: en modo portadas, las series para las rutas de `/tv`. */
const listFor = (pathname) => (COVERS && /\/tv\b/.test(pathname) ? COVER_TV : tmdbResults);

function tmdbDetail(id) {
  const base =
    [...tmdbResults, ...COVER_TV].find((m) => m.id === id) ?? tmdbMovie({ id, title: `Título ${id}`, year: 2020 }, 0);
  return {
    ...base,
    runtime: 139,
    number_of_seasons: 1,
    number_of_episodes: 8,
    status: "Released",
    tagline: "",
    genres: [
      { id: 18, name: "Drama" },
      { id: 53, name: "Suspense" },
    ],
    credits: { cast: [], crew: [] },
    videos: { results: [] },
    "watch/providers": { results: {} },
    external_ids: {},
    production_companies: [],
    spoken_languages: [],
  };
}

/** Respuesta de TMDB para una ruta `/3/...` (null = 404). */
function tmdbResponse(pathname) {
  const detail = pathname.match(/^\/3\/(movie|tv)\/(\d+)(\/.*)?$/);
  if (detail) {
    const [, , id, sub] = detail;
    if (!sub) return tmdbDetail(Number(id));
    if (sub === "/videos") return { id: Number(id), results: [] };
    if (sub === "/watch/providers") return { id: Number(id), results: {} };
    if (sub === "/credits") return { id: Number(id), cast: [], crew: [] };
    if (sub === "/external_ids") return { id: Number(id) };
    // recommendations, similar…
    const results = listFor(pathname);
    return { page: 1, total_pages: 1, total_results: results.length, results };
  }
  if (pathname.startsWith("/3/genre/")) {
    return {
      genres: [
        { id: 18, name: "Drama" },
        { id: 53, name: "Suspense" },
        { id: 35, name: "Comedia" },
      ],
    };
  }
  if (pathname === "/3/configuration") return { images: {} };
  const results = listFor(pathname);
  return { page: 1, total_pages: 1, total_results: results.length, results };
}

/** Filas de `media` (catálogo cacheado) para listas y biblioteca. */
const coverRows = COVERS
  ? covers.CATALOGUE.map((c) => ({
      id: covers.mediaId(c),
      external_id: c.externalId,
      type: c.type,
      title: c.title,
      poster: c.poster,
      backdrop: null,
      year: c.year,
      synopsis: `Sinopsis de prueba de ${c.title}.`,
      genres: ["Drama"],
      metadata: null,
      updated_at: NOW,
    }))
  : null;
const mediaRows = coverRows ?? MOVIES.slice(0, 4).map((m) => ({
  id: `movie_${m.id}`,
  external_id: String(m.id),
  type: "movie",
  title: m.title,
  poster: null,
  backdrop: null,
  year: m.year,
  synopsis: `Sinopsis de prueba de ${m.title}.`,
  genres: ["Drama"],
  metadata: null,
  updated_at: NOW,
}));

const list = {
  id: LIST_ID,
  owner_id: USER_ID,
  name: "Pelis para el finde",
  media_type: "movie",
  is_collaborative: true,
  is_public: false,
  created_at: NOW,
};

const PUBLIC_LIST_ID = "00000000-0000-4000-8000-0000000000a2";
const publicList = {
  id: PUBLIC_LIST_ID,
  owner_id: "00000000-0000-4000-8000-000000000003",
  name: "Lo mejor que he visto este año",
  media_type: "movie",
  is_collaborative: false,
  is_public: true,
  created_at: NOW,
};

const group = {
  id: GROUP_ID,
  name: "Club de cine",
  description: "Hablamos de pelis",
  owner_id: USER_ID,
  cover_color: "oklch(68% 0.24 350)",
  is_public: true,
  icon: null,
  created_at: NOW,
};

/** Tablas de PostgREST. Lo que no está aquí responde vacío. */
const tables = {
  users: [user, friend, benevi],
  media: mediaRows,
  // Modo portadas: además, una lista pública de benevi para `/u/benevi`.
  lists: COVERS ? [list, publicList] : [list],
  list_items: [
    ...mediaRows.slice(0, COVERS ? 8 : 2).map((m, i) => ({
      id: `00000000-0000-4000-8000-0000000000d${i}`,
      list_id: LIST_ID,
      media_id: m.id,
      added_by: USER_ID,
      added_at: NOW,
    })),
    ...(COVERS
      ? mediaRows
          .filter((m) => m.type === "movie")
          .map((m, i) => ({
            id: `00000000-0000-4000-8000-0000000000e${i.toString(16)}`,
            list_id: PUBLIC_LIST_ID,
            media_id: m.id,
            added_by: benevi.id,
            added_at: NOW,
            position: i,
          }))
      : []),
  ],
  // Matrix ya está en la biblioteca: su ficha enseña "Actualizar" y "Eliminar".
  // En modo portadas: una biblioteca con los cuatro estados en los 7 formatos.
  user_media: COVERS ? coverLibrary() : [
    {
      id: "00000000-0000-4000-8000-0000000000a9",
      user_id: USER_ID,
      media_id: "movie_603",
      status: "completed",
      score: 4,
      watched_at: null,
      episode_progress: null,
      created_at: NOW,
      updated_at: NOW,
    },
  ],
  groups: [group],
  group_members: [{ group_id: GROUP_ID, user_id: USER_ID, role: "owner", joined_at: NOW }],
  friendships: [
    {
      id: "00000000-0000-4000-8000-0000000000e1",
      requester_id: USER_ID,
      receiver_id: FRIEND_ID,
      status: "accepted",
      created_at: NOW,
    },
  ],
  conversations: [{ id: CONVERSATION_ID, created_at: NOW, last_message_at: NOW }],
  conversation_members: [
    { conversation_id: CONVERSATION_ID, user_id: USER_ID, last_read_at: NOW },
    { conversation_id: CONVERSATION_ID, user_id: FRIEND_ID, last_read_at: NOW },
  ],
  messages: [
    {
      id: "00000000-0000-4000-8000-0000000000f1",
      conversation_id: CONVERSATION_ID,
      sender_id: FRIEND_ID,
      content: "¿Has visto Origen?",
      created_at: NOW,
    },
  ],
};

/** Biblioteca del modo portadas (la del usuario de prueba y la de benevi). */
function coverLibrary() {
  const STATUS = ["completed", "in_progress", "pending", "abandoned", "completed", "pending"];
  const rows = [];
  covers.CATALOGUE.slice(0, 16).forEach((c, i) => {
    for (const [owner, offset] of [[USER_ID, 0], [benevi.id, 1]]) {
      const status = STATUS[(i + offset) % STATUS.length];
      const day = String(1 + ((i * 3 + offset) % 27)).padStart(2, "0");
      rows.push({
        id: `00000000-0000-4000-8000-${String(i * 2 + offset).padStart(4, "0")}000000a9`.slice(0, 36),
        user_id: owner,
        media_id: covers.mediaId(c),
        status,
        score: status === "completed" ? (i % 3 === 0 ? 5 : 4) : null,
        rating10: status === "completed" ? (i % 3 === 0 ? 10 : 8) : null,
        favorite: i % 5 === 0,
        watched_at: status === "completed" ? `2026-10-${day}T20:00:00.000Z` : null,
        episode_progress: status === "in_progress" ? 4 : null,
        created_at: NOW,
        updated_at: `2026-10-${day}T20:00:00.000Z`,
      });
    }
  });
  return rows;
}

module.exports = {
  PUBLIC_LIST_ID,
  USER_ID,
  FRIEND_ID,
  LIST_ID,
  GROUP_ID,
  CONVERSATION_ID,
  NOW,
  user,
  tables,
  tmdbResponse,
};
