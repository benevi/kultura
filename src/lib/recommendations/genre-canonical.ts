// ============================================================
// KULTURA — Vocabulario canónico de géneros (E-MATCH-VOCAB)
//
// Cada proveedor nombra los géneros a su manera, y TMDB además los LOCALIZA:
// la misma película es "Acción" en español y "Action" en inglés, mientras que
// AniList dice "Action", RAWG "Action"/"Platformer" y Google Books
// "Fiction / Science Fiction". El perfil de gustos (`buildTasteProfile`) y la
// puntuación (`scoreItem`) comparaban esas cadenas TAL CUAL, así que:
//   - una biblioteca de cine en español no podía puntuar NUNCA un anime, un
//     juego o un libro (vocabularios distintos), y
//   - cambiar el idioma de la app ensuciaba el perfil del propio usuario
//     ("Acción" y "Action" contaban como géneros diferentes).
// Con pocas entradas en biblioteca eso se traduce en 0% MATCH casi en todo.
//
// Aquí se traduce cualquier nombre de género al MISMO slug canónico que ya usa
// el resto de la app para los filtros de Descubrir (`accion`, `aventura`,
// `ciencia-ficcion`…), de modo que el cruce entre tipos e idiomas funcione.
//
// Es una capa de MATCH, no de presentación: `MediaItem.genres` sigue llevando
// el nombre del proveedor, que es lo que se pinta en la ficha y en el perfil.
// ============================================================

/**
 * Nombre de género (ya normalizado: minúsculas y sin acentos) → slug canónico.
 *
 * Un nombre puede valer por VARIOS slugs: TMDB agrupa en televisión géneros que
 * en cine van sueltos ("Acción y Aventura", "Sci-Fi y Fantasía"), y se expanden
 * a sus componentes para que una serie de acción pueda puntuar contra una
 * película de acción.
 *
 * Los géneros que un proveedor tiene y el vocabulario canónico no (Mecha,
 * Ecchi, Board Games…) se omiten a propósito: es preferible ignorarlos a
 * inventar un slug que ningún otro proveedor podría igualar.
 */
const GENRE_ALIASES: Record<string, string[]> = {
  // ── TMDB cine, español ──────────────────────────────────────────────────
  accion: ['accion'],
  aventura: ['aventura'],
  animacion: ['animacion'],
  comedia: ['comedia'],
  crimen: ['crimen'],
  documental: ['documental'],
  drama: ['drama'],
  familia: ['familia'],
  fantasia: ['fantasia'],
  historia: ['historia'],
  terror: ['terror'],
  musica: ['musica'],
  misterio: ['misterio'],
  romance: ['romance'],
  'ciencia ficcion': ['ciencia-ficcion'],
  suspense: ['suspense'],
  belica: ['belica'],
  western: ['western'],

  // ── TMDB cine, inglés (y nombres en inglés de AniList/MangaDex/MAL/RAWG) ──
  action: ['accion'],
  adventure: ['aventura'],
  animation: ['animacion'],
  comedy: ['comedia'],
  crime: ['crimen'],
  documentary: ['documental'],
  family: ['familia'],
  fantasy: ['fantasia'],
  history: ['historia'],
  historical: ['historia'],
  horror: ['terror'],
  music: ['musica'],
  mystery: ['misterio'],
  'science fiction': ['ciencia-ficcion'],
  'sci-fi': ['ciencia-ficcion'],
  thriller: ['suspense'],
  thrillers: ['suspense'],
  war: ['belica'],
  military: ['belica'],

  // ── TMDB televisión (géneros combinados → se expanden) ───────────────────
  'accion y aventura': ['accion', 'aventura'],
  'action & adventure': ['accion', 'aventura'],
  'ciencia ficcion y fantasia': ['ciencia-ficcion', 'fantasia'],
  'sci-fi & fantasy': ['ciencia-ficcion', 'fantasia'],
  'guerra y politica': ['belica'],
  'war & politics': ['belica'],
  infantil: ['infantil'],
  kids: ['infantil'],
  noticias: ['noticias'],
  news: ['noticias'],
  reality: ['reality'],
  telenovela: ['telenovela'],
  soap: ['telenovela'],
  talk: ['talk'],

  // ── AniList / MangaDex / MAL ────────────────────────────────────────────
  'slice of life': ['recuentos-de-la-vida'],
  sports: ['deportes'],
  deportes: ['deportes'],
  supernatural: ['sobrenatural'],

  // ── RAWG ────────────────────────────────────────────────────────────────
  rpg: ['rpg'],
  'role-playing games (rpg)': ['rpg'],
  strategy: ['estrategia'],
  shooter: ['shooter'],
  indie: ['indie'],
  casual: ['casual'],
  simulation: ['simulacion'],
  puzzle: ['puzzle'],
  arcade: ['arcade'],
  platformer: ['plataformas'],
  racing: ['carreras'],
  fighting: ['lucha'],

  // ── Google Books (términos BISAC) ───────────────────────────────────────
  // "Action & Adventure" ya está arriba: TMDB lo usa igual en televisión.
  humor: ['comedia'],
  'true crime': ['crimen'],
  'mystery & detective': ['misterio'],
  poetry: ['poesia'],
  'biography & autobiography': ['biografia'],
  'juvenile fiction': ['infantil'],
  essays: ['ensayo'],
}

/** minúsculas, sin acentos y sin espacios de sobra: la forma en que se indexa la tabla. */
function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Slugs de UN nombre de género, o [] si el vocabulario canónico no lo cubre. */
function slugsForName(raw: string): string[] {
  const name = normalizeName(raw)
  const direct = GENRE_ALIASES[name]
  if (direct) return direct

  // Google Books encadena la jerarquía BISAC en una sola cadena
  // ("Fiction / Science Fiction / General"): cada tramo puede ser un género.
  if (name.includes('/')) {
    return name
      .split('/')
      .flatMap((part) => GENRE_ALIASES[part.trim()] ?? [])
  }

  return []
}

/**
 * Traduce una lista de géneros de cualquier proveedor a slugs canónicos, sin
 * duplicados. Lo que no esté en el vocabulario se descarta.
 */
export function canonicalGenres(genres: string[] | undefined | null): string[] {
  if (!genres?.length) return []
  const slugs = new Set<string>()
  for (const genre of genres) {
    if (typeof genre !== 'string') continue
    for (const slug of slugsForName(genre)) slugs.add(slug)
  }
  return Array.from(slugs)
}
