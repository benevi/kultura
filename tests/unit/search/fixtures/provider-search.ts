// ============================================================
// KULTURA — Respuestas de búsqueda con la forma REAL de cada proveedor
// (F-13). Las formas son las que documentan los clientes y normalizadores:
//   - TMDB `/search/movie` y `/search/tv` (`tmdb.ts`, `normalizeMovie/TV`)
//   - AniList `Page.media` (`anilist.ts`, `normalizeAniListAnime`)
//   - Open Library `/search.json` `docs` (`openlibrary.ts`)
//   - RAWG `/games?search=` `results` (`rawg.ts`, `normalizeGame`)
// Cada consulta trae 10-14 candidatos en un orden de proveedor verosímil
// (por popularidad o por coincidencia de texto, no por "la obra"): secuelas,
// temporadas, ediciones, spin-offs, homónimos, títulos en otro idioma y algún
// resultado sin portada. Los títulos y años son reales; ids, votos y notas,
// aproximados.
// ============================================================

let seq = 1000;
const nextId = () => ++seq;

// ── TMDB cine ─────────────────────────────────────────────────────────────────
type M = [title: string, year: number, votes: number, original?: string, poster?: boolean];
function tmdbMovies(list: M[]) {
  return list.map(([title, year, votes, original, poster = true]) => {
    const id = nextId();
    return {
      id,
      title,
      original_title: original ?? title,
      release_date: `${year}-06-01`,
      poster_path: poster ? `/m${id}.jpg` : null,
      backdrop_path: null,
      overview: "",
      vote_average: votes > 100 ? 7.4 : 5.9,
      vote_count: votes,
      popularity: votes / 100,
      genre_ids: [],
      original_language: "en",
    };
  });
}

export const MOVIE_CASES: [query: string, results: ReturnType<typeof tmdbMovies>, expected: RegExp][] = [
  ["dune", tmdbMovies([
    ["Dune: Parte dos", 2024, 6900, "Dune: Part Two"], ["Dune", 2021, 13000], ["Dune", 1984, 3100],
    ["Dune: Parte tres", 2026, 40, "Dune: Part Three", false], ["Jodorowsky's Dune", 2013, 700],
    ["Dune Drifter", 2020, 90], ["Dune World", 2021, 12], ["Dune Warriors", 1991, 25], ["Dunas", 2022, 8],
    ["Dune: La herencia", 2021, 15], ["Dune: The Making Of", 2021, 30], ["Lynch/Oz", 2022, 20],
  ]), /^dune$/i],
  ["inception", tmdbMovies([
    ["Bikini Inception", 2015, 40], ["Origen", 2010, 37000, "Inception"], ["Inception: The Cobol Job", 2010, 300],
    ["The Inception of Ripley", 2021, 5], ["Inception: Jump Right Into the Action", 2010, 30],
    ["Inceptor", 2023, 3, undefined, false], ["Interstellar", 2014, 34000], ["Insidious", 2010, 7000],
    ["Origen: El making of", 2010, 20], ["Dream Inception", 2018, 6],
  ]), /^origen$|^inception$/i],
  ["el padrino", tmdbMovies([
    ["El padrino. Parte II", 1974, 12000, "The Godfather Part II"], ["El padrino. Parte III", 1990, 6000, "The Godfather Part III"],
    ["El padrino", 1972, 20000, "The Godfather"], ["El padrino de la novia", 1999, 30], ["Mi padrino", 2003, 4],
    ["El Padrino, epílogo: La muerte de Michael Corleone", 2020, 700, "The Godfather Coda"],
    ["El padrino (making of)", 1991, 10], ["Padrinos", 2019, 15], ["El padrino de Hong Kong", 1985, 9],
    ["El padrino rojo", 1970, 2],
  ]), /^el padrino$/i],
  ["avatar", tmdbMovies([
    ["Avatar: El sentido del agua", 2022, 12000, "Avatar: The Way of Water"], ["Avatar: Fuego y ceniza", 2025, 900, "Avatar: Fire and Ash"],
    ["Avatar", 2009, 32000], ["Avatar: Creating the World of Pandora", 2010, 80], ["Avatar Spirits", 2010, 20],
    ["Avatar 4", 2029, 0, undefined, false], ["Avatar: La leyenda de Aang – El último maestro aire", 2010, 4800, "The Last Airbender"],
    ["Avatar: Scene Deconstruction", 2010, 10], ["Avatarios", 2013, 2], ["Avatar: Real", 2015, 1],
  ]), /^avatar$/i],
  ["coco", tmdbMovies([
    ["Coco Chanel & Igor Stravinsky", 2009, 300], ["Coco", 2017, 19000], ["Coco, de la rebeldía a la leyenda de Chanel", 2009, 1900, "Coco avant Chanel"],
    ["Coco", 2009, 60], ["Coco Farm", 2008, 10], ["Cocoon", 1985, 1600], ["Coco y el Rey de la Selva", 2022, 4],
    ["Coco Before Chanel: Making Of", 2009, 2, undefined, false], ["Coconut the Little Dragon", 2014, 30], ["Cocote", 2017, 25],
  ]), /^coco$/i],
  ["spiderman", tmdbMovies([
    ["Spider-Man: No Way Home", 2021, 20000], ["Spider-Man: Cruzando el Multiverso", 2023, 7000, "Spider-Man: Across the Spider-Verse"],
    ["Spider-Man: Lejos de casa", 2019, 15000, "Spider-Man: Far From Home"], ["Spider-Man", 2002, 19000],
    ["Spider-Man 2", 2004, 15000], ["The Amazing Spider-Man", 2012, 17000], ["Spider-Man: Homecoming", 2017, 21000],
    ["Spider-Man: Un nuevo universo", 2018, 15000, "Spider-Man: Into the Spider-Verse"], ["Spider-Man 3", 2007, 14000],
    ["Spiderman: The Venom Saga", 1994, 30],
  ]), /^spider-man$/i],
  ["matrix", tmdbMovies([
    ["Matrix Resurrections", 2021, 6000, "The Matrix Resurrections"], ["Matrix", 1999, 26000, "The Matrix"],
    ["Matrix Reloaded", 2003, 11000, "The Matrix Reloaded"], ["Matrix Revolutions", 2003, 9000, "The Matrix Revolutions"],
    ["Animatrix", 2003, 1200, "The Animatrix"], ["The Matrix Revisited", 2001, 200], ["Matrix: Generation", 2023, 3],
    ["Matrix of Evil", 2003, 6], ["Making 'The Matrix'", 1999, 40], ["Return to Source: The Philosophy of The Matrix", 2004, 30],
  ]), /^matrix$/i],
  ["gladiator", tmdbMovies([
    ["Gladiator II", 2024, 3000], ["Gladiator", 2000, 20000], ["Gladiators", 2023, 20], ["The Gladiator", 1986, 25],
    ["Gladiator: El origen", 2005, 10], ["Gladiator Days", 2002, 4], ["The Gladiators", 1969, 12],
    ["Gladiator Cop", 1994, 8], ["Gladiatress", 2004, 15], ["Gladiator: The Making Of", 2000, 30, undefined, false],
  ]), /^gladiator$/i],
  ["your name", tmdbMovies([
    ["Your Name Engraved Herein", 2020, 600], ["Your Name.", 2016, 11000, "君の名は。"], ["Say Your Name", 2018, 10],
    ["What's Your Name", 2009, 6], ["Call Me by Your Name", 2017, 12000], ["Your Name in My Heart", 2022, 2],
    ["In Your Name", 2014, 5], ["Say My Name", 2019, 30], ["My Name", 2021, 400], ["Your Name Is Mine", 2008, 3],
  ]), /^your name/i],
  ["titanic", tmdbMovies([
    ["Titanic II", 2010, 300], ["Titanic", 1997, 25000], ["Titanic", 1953, 300], ["Titanic: La leyenda continúa", 2000, 200, "Titanic: The Legend Goes On"],
    ["Raise the Titanic", 1980, 150], ["Titanic 666", 2022, 60], ["Ghosts of the Abyss", 2003, 200],
    ["Titanic: 20 Years Later", 2017, 30], ["S.O.S. Titanic", 1979, 40], ["Titanic Town", 1998, 20],
  ]), /^titanic$/i],
];

// ── TMDB series ───────────────────────────────────────────────────────────────
type T = [name: string, year: number, votes: number, original?: string, country?: string];
function tmdbTv(list: T[]) {
  return list.map(([name, year, votes, original, country = "US"]) => {
    const id = nextId();
    return {
      id,
      name,
      original_name: original ?? name,
      first_air_date: `${year}-01-15`,
      poster_path: `/t${id}.jpg`,
      backdrop_path: null,
      overview: "",
      vote_average: 7.6,
      vote_count: votes,
      popularity: votes / 100,
      origin_country: [country],
      original_language: country === "DE" ? "de" : "en",
      genre_ids: [],
    };
  });
}

export const TV_CASES: [query: string, results: ReturnType<typeof tmdbTv>, expected: RegExp | ((r: { title: string; year?: number }) => boolean)][] = [
  ["dark", tmdbTv([
    ["Dark Shadows", 1966, 120], ["Dark", 2017, 7000, "Dark", "DE"], ["Dark Matter", 2015, 600], ["Dark Desire", 2020, 900, "Oscuro deseo", "MX"],
    ["Dark Winds", 2022, 300], ["Dark Angel", 2000, 900], ["Dark Net", 2016, 40], ["Dark Side of the Ring", 2019, 150],
    ["Dark Shadows", 1991, 40], ["Dark Tourist", 2018, 200], ["Dark Matter", 2024, 400],
  ]), /^dark$/i],
  ["friends", tmdbTv([
    ["Friends with Benefits", 2011, 90], ["Friends", 1994, 9000], ["Friends from College", 2017, 200], ["Close Friends", 2023, 3],
    ["Good Friends", 2019, 4], ["Friends and Neighbors", 2025, 60], ["Fake Friends", 2021, 2], ["Best Friends Whenever", 2015, 80],
    ["Friends of the People", 2014, 10], ["Friends: The Reunion", 2021, 1200],
  ]), /^friends$/i],
  ["the office", tmdbTv([
    ["The Office", 2001, 1100, "The Office", "GB"], ["The Office", 2005, 4300], ["The Office", 2024, 40, "The Office", "AU"],
    ["The Office Mix", 2023, 2], ["Office Girls", 2011, 30], ["The Office Retreat", 2021, 1], ["Office Ladies", 2019, 5],
    ["The Back Office", 2008, 3], ["The Office Christmas Specials", 2003, 60], ["Corner Office", 2022, 8],
  ]), (r) => r.title === "The Office" && r.year === 2005],
  ["la casa de papel", tmdbTv([
    ["La casa de papel: Corea", 2022, 700, "종이의 집: 공동경제구역", "KR"], ["La casa de papel", 2017, 18000, "La casa de papel", "ES"],
    ["La casa de papel: De Tokio a Berlín", 2021, 300, "La casa de papel: de Tokio a Berlín", "ES"], ["Berlín", 2023, 900, "Berlín", "ES"],
    ["La casa de las flores", 2018, 600, "La casa de las flores", "MX"], ["La casa del dragón", 2022, 4000, "House of the Dragon"],
    ["La casa de los famosos", 2021, 20, "La casa de los famosos", "MX"], ["Casa de papel", 2019, 2, "Casa de papel", "BR"],
    ["La casa de Mickey Mouse", 2006, 300, "Mickey Mouse Clubhouse"], ["La casa de la pradera", 1974, 900, "Little House on the Prairie"],
  ]), /^la casa de papel$/i],
  ["shogun", tmdbTv([
    ["Shōgun", 2024, 1000, "Shōgun"], ["Shogun", 1980, 250], ["Shogun's Ninja", 1983, 4], ["Shogun Assassin", 1980, 30, undefined, "JP"],
    ["The Shogun's Mistress", 1985, 3], ["Shotgun Wedding", 2023, 20], ["Shogun Mayeda", 1991, 6], ["Ninja Shogun", 2001, 1],
    ["Shogun Warriors", 1979, 5], ["The Last Shogun", 2013, 10],
  ]), /^sh[oō]gun$/i],
  ["the boys", tmdbTv([
    ["The Boys Presents: Diabolical", 2022, 900], ["The Boys", 2019, 11000], ["Boys Over Flowers", 2009, 900, "꽃보다 남자", "KR"],
    ["The Boys from Brazil", 1999, 2], ["Gen V", 2023, 1200], ["The Boys of Summer", 2022, 3], ["Boys Planet", 2023, 20, "보이즈 플래닛", "KR"],
    ["The Boys in the Band", 2020, 300], ["The Boys Club", 2015, 1], ["The Boys: México", 2026, 0, undefined, "MX"],
  ]), /^the boys$/i],
  ["chernobyl", tmdbTv([
    ["Chernobyl: The Lost Tapes", 2022, 60], ["Chernóbil", 2019, 9000, "Chernobyl"], ["Chernobyl: Zona de exclusión", 2014, 100, "Чернобыль. Зона отчуждения", "RU"],
    ["Chernobyl Diaries", 2012, 1300], ["Chernobyl 1986", 2021, 300, "Чернобыль", "RU"], ["Surviving Disaster", 2006, 20],
    ["Chernobyl Heart", 2003, 30], ["The Battle of Chernobyl", 2006, 40], ["Inside Chernobyl", 2018, 5], ["Chernobyl Liquidators", 2011, 3],
  ]), /^chern[oó]b[iy]l$/i],
  ["fallout", tmdbTv([
    ["Fallout Shelter", 2015, 3], ["Fallout", 2024, 4500], ["Fallout Boy", 2019, 1], ["Fallout: Lore Explained", 2023, 2],
    ["After the Fallout", 2016, 10], ["Fallout Season", 2014, 4], ["Nuclear Fallout", 2022, 6], ["Fallout Family", 2020, 2],
    ["Fallout in the Pacific", 2011, 1], ["Atomic Fallout", 2005, 3],
  ]), /^fallout$/i],
  ["succession", tmdbTv([
    ["The Succession Game", 2021, 3], ["Succession", 2018, 4000], ["Succession of Witches", 2016, 1], ["Royal Succession", 2012, 6],
    ["The Succession", 2023, 2], ["Succession: Behind the Scenes", 2019, 4], ["Line of Succession", 2002, 8],
    ["Succession Wars", 2017, 1], ["Family Succession", 2020, 2], ["Succession Planning", 2010, 1],
  ]), (r) => r.title === "Succession" && r.year === 2018],
  ["stranger things", tmdbTv([
    ["Stranger Things: Tales From '85", 2026, 50], ["Stranger Things", 2016, 18000], ["Stranger Things: Spotlight", 2017, 3],
    ["Beyond Stranger Things", 2017, 100], ["Strangers", 2018, 40], ["Stranger", 2017, 400, "비밀의 숲", "KR"], ["Stranger Things Day", 2019, 1],
    ["Strange Things", 2001, 5], ["Stranger Things: The Experience", 2022, 2], ["Strangers from Hell", 2019, 200, "타인은 지옥이다", "KR"],
  ]), /^stranger things$/i],
];

// ── AniList anime ─────────────────────────────────────────────────────────────
type A = [english: string | null, romaji: string, year: number, score?: number];
function anilist(list: A[]) {
  return list.map(([english, romaji, year, score = 75]) => {
    const id = nextId();
    return {
      id,
      title: { english, romaji, native: null },
      coverImage: { large: `https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx${id}.jpg`, extraLarge: null },
      description: null,
      genres: ["Action"],
      averageScore: score,
      seasonYear: year,
      startDate: { year },
      episodes: 12,
      status: "FINISHED",
      studios: { nodes: [] },
      trailer: null,
      source: "MANGA",
    };
  });
}

export const ANIME_CASES: [query: string, results: ReturnType<typeof anilist>, expected: RegExp][] = [
  ["naruto", anilist([
    ["Naruto Shippuden", "Naruto: Shippuuden", 2007], ["Naruto", "NARUTO", 2002], ["Boruto: Naruto Next Generations", "BORUTO: NARUTO NEXT GENERATIONS", 2017],
    ["Road of Naruto", "ROAD OF NARUTO", 2022], ["Naruto the Movie: Ninja Clash in the Land of Snow", "Naruto Movie 1", 2004],
    ["Naruto: The Lost Story", "Naruto: Takigakure no Shitou", 2003], ["The Last: Naruto the Movie", "THE LAST: NARUTO THE MOVIE", 2014],
    ["Naruto Shippuden: The Movie", "Gekijouban Naruto Shippuuden", 2007], ["Naruto Spin-Off: Rock Lee", "NARUTO SD: Rock Lee no Seishun Full-Power Ninden", 2012],
    ["Boruto: Naruto the Movie", "BORUTO: NARUTO THE MOVIE", 2015],
  ]), /^naruto$/i],
  ["bleach", anilist([
    ["Bleach: Thousand-Year Blood War", "BLEACH: Sennen Kessen-hen", 2022, 90], ["Bleach", "BLEACH", 2004, 78],
    ["Bleach: Thousand-Year Blood War - The Separation", "BLEACH: Sennen Kessen-hen - Ketsubetsu-tan", 2023],
    ["Bleach the Movie: Memories of Nobody", "BLEACH: Memories of Nobody", 2006], ["Bleach the Movie: Fade to Black", "BLEACH: Fade to Black", 2008],
    ["Bleach: The Sealed Sword Frenzy", "BLEACH: Memories in the Rain", 2006], ["Bleach the Movie: Hell Verse", "BLEACH: Jigoku-hen", 2010],
    ["Bleach the Movie: The DiamondDust Rebellion", "BLEACH: The DiamondDust Rebellion", 2007], ["Bleach: Thousand-Year Blood War - The Conflict", "BLEACH: Sennen Kessen-hen - Soukoku-tan", 2024],
    [null, "Bleach Pilot", 2001],
  ]), /^bleach$/i],
  ["frieren", anilist([
    ["Frieren: Beyond Journey's End Season 2", "Sousou no Frieren 2nd Season", 2026], ["Frieren: Beyond Journey's End", "Sousou no Frieren", 2023, 91],
    [null, "Sousou no Frieren: ●● no Mahou", 2023], ["Frieren: Beyond Journey's End Recap", "Sousou no Frieren Recap", 2024],
    [null, "Freezing", 2011], ["Fern ties Frieren's hair", "Sousou no Frieren Mini", 2023], [null, "Friends", 2011],
    ["Frieren: The Magic of Enjoying", "Sousou no Frieren Special", 2024], [null, "Free!", 2013], [null, "Frieza Saga", 1990],
  ]), /^frieren: beyond journey's end$/i],
  ["jujutsu kaisen", anilist([
    ["Jujutsu Kaisen Season 2", "Jujutsu Kaisen 2nd Season", 2023], ["Jujutsu Kaisen 0", "Gekijouban Jujutsu Kaisen 0", 2021],
    ["Jujutsu Kaisen", "Jujutsu Kaisen", 2020, 85], ["Jujutsu Kaisen: The Culling Game Part 1", "Jujutsu Kaisen: Shimetsu Kaiyuu - Zenpen", 2026],
    [null, "Jujutsu Kaisen Picture Drama", 2021], ["Jujutsu Kaisen: Hidden Inventory", "Jujutsu Kaisen: Kaigyoku", 2023],
    [null, "Jujutsu Kaisen x Uniqlo", 2021], ["Jujutsu Kaisen Season 2 Recap", "Jujutsu Kaisen Soushuuhen", 2023],
    [null, "Jujutsushi", 2018], ["Jujutsu Kaisen: Execution", "Jujutsu Kaisen: Kaigyoku Gyokusetsu", 2025],
  ]), /^jujutsu kaisen$/i],
  ["one punch man", anilist([
    ["One-Punch Man Season 3", "One Punch Man 3", 2025], ["One-Punch Man Season 2", "One Punch Man 2", 2019],
    ["One-Punch Man", "One Punch Man", 2015, 83], ["One-Punch Man: Road to Hero", "One Punch Man: Road to Hero", 2015],
    ["One-Punch Man Specials", "One Punch Man Specials", 2015], ["One-Punch Man 2nd Season Specials", "One Punch Man 2 Specials", 2019],
    [null, "One Punch Man: Gaiden", 2016], ["One-Punch Man Season 2 Commemorative Special", "One Punch Man 2 Special", 2019],
    [null, "Punch Line", 2015], [null, "Megalo Box", 2018],
  ]), /^one-punch man$/i],
  ["cowboy bebop", anilist([
    ["Cowboy Bebop: The Movie", "Cowboy Bebop: Tengoku no Tobira", 2001, 82], ["Cowboy Bebop", "Cowboy Bebop", 1998, 86],
    ["Cowboy Bebop: Yose Atsume Blues", "Cowboy Bebop: Yose Atsume Blues", 1998], [null, "Cowboy Bebop: Session XX", 1998],
    [null, "Space Dandy", 2014], [null, "Samurai Champloo", 2004], [null, "Trigun", 1998], [null, "Outlaw Star", 1998],
    [null, "Cowboy Bebop Session 0", 1998], [null, "Bebop Pilot", 1997],
  ]), /^cowboy bebop$/i],
  ["death note", anilist([
    ["Death Note: Relight", "DEATH NOTE: Rewrite", 2007], ["Death Note", "DEATH NOTE", 2006, 84], [null, "DEATH NOTE Pilot", 2003],
    ["Death Parade", "Death Parade", 2015], [null, "Deadman Wonderland", 2011], [null, "Death Billiards", 2013],
    ["Death Note: Relight 2", "DEATH NOTE: Rewrite 2", 2008], [null, "Death Note Special", 2007], ["Notes of Death", "Shi no Note", 2010],
    [null, "Death March", 2018],
  ]), /^death note$/i],
  ["spy x family", anilist([
    ["SPY x FAMILY Season 2", "SPY×FAMILY Season 2", 2023], ["SPY x FAMILY CODE: White", "Gekijouban SPY×FAMILY CODE: White", 2023],
    ["SPY x FAMILY", "SPY×FAMILY", 2022, 85], ["SPY x FAMILY Part 2", "SPY×FAMILY Part 2", 2022], ["SPY x FAMILY Season 3", "SPY×FAMILY Season 3", 2025],
    [null, "SPY×FAMILY: Anya's Hobby", 2022], [null, "Spy Classroom", 2023], [null, "Spy Kyoushitsu", 2023], [null, "Family Compo", 1997],
    [null, "SPY×FAMILY Special", 2023],
  ]), /^spy x family$/i],
  ["attack on titan", anilist([
    ["Attack on Titan Final Season", "Shingeki no Kyojin: The Final Season", 2020], ["Attack on Titan Season 2", "Shingeki no Kyojin Season 2", 2017],
    ["Attack on Titan", "Shingeki no Kyojin", 2013, 85], ["Attack on Titan: Junior High", "Shingeki! Kyojin Chuugakkou", 2015],
    ["Attack on Titan: No Regrets", "Shingeki no Kyojin: Kuinaki Sentaku", 2014], ["Attack on Titan Season 3", "Shingeki no Kyojin Season 3", 2018],
    ["Attack on Titan: Lost Girls", "Shingeki no Kyojin: Lost Girls", 2017], ["Attack on Titan: The Last Attack", "Gekijouban Shingeki no Kyojin Kanketsu-hen", 2024],
    ["Attack on Titan OVA", "Shingeki no Kyojin OVA", 2013], ["Attack on Titan Season 3 Part 2", "Shingeki no Kyojin Season 3 Part 2", 2019],
  ]), /^attack on titan$/i],
  ["vinland saga", anilist([
    ["Vinland Saga Season 2", "Vinland Saga Season 2", 2023, 88], ["Vinland Saga", "Vinland Saga", 2019, 87], [null, "Vinland Saga Recap", 2019],
    [null, "Vinland Saga Pilot", 2005], [null, "Saga of Tanya the Evil", 2017], [null, "Arslan Senki", 2015], [null, "Berserk", 1997],
    [null, "Golden Kamuy", 2018], [null, "Dororo", 2019], [null, "Kingdom", 2012],
  ]), /^vinland saga$/i],
];

// ── Open Library libros ───────────────────────────────────────────────────────
type B = [title: string, year: number, lang: string, cover?: boolean];
function openLibrary(list: B[]) {
  return list.map(([title, year, lang, cover = true]) => {
    const id = nextId();
    return {
      key: `/works/OL${id}W`,
      title,
      author_name: ["Autor"],
      first_publish_year: year,
      cover_i: cover ? id : undefined,
      language: [lang],
    };
  });
}

export const BOOK_CASES: [query: string, docs: ReturnType<typeof openLibrary>, expected: RegExp][] = [
  ["el señor de los anillos", openLibrary([
    ["The Lord of the Rings", 1954, "eng"], ["El Señor de los Anillos", 1978, "spa"], ["El Señor de los Anillos: La Comunidad del Anillo", 1978, "spa"],
    ["The Fellowship of the Ring", 1954, "eng"], ["El Señor de los Anillos: Las dos torres", 1979, "spa"], ["Der Herr der Ringe", 1969, "ger"],
    ["El Señor de los Anillos. Guía ilustrada", 2002, "spa"], ["Le Seigneur des Anneaux", 1972, "fre"], ["Il Signore degli Anelli", 1970, "ita"],
    ["El Señor de los Anillos: El retorno del Rey", 1980, "spa"], ["Los anillos de poder", 2022, "spa", false],
  ]), /^el señor de los anillos$/i],
  ["berserk", openLibrary([
    ["ベルセルク 1", 1990, "jpn"], ["ベルセルク 2", 1990, "jpn"], ["ベルセルク 40", 2018, "jpn"], ["Berserk Deluxe Edition Volume 1", 2019, "eng"],
    ["Berserk, Vol. 1", 2003, "eng"], ["Berserker", 1967, "eng"], ["Berserk: The Prototype", 2004, "eng"], ["Berserk Official Guidebook", 2016, "eng"],
    ["The Berserkers", 1990, "eng"], ["Berserk Max", 2015, "spa"],
  ]), /^berserk/i],
  ["dune", openLibrary([
    ["Dune Messiah", 1969, "eng"], ["Dune", 1965, "eng"], ["Children of Dune", 1976, "eng"], ["Dune: La saga", 2003, "spa"], ["Duna", 1975, "spa"],
    ["The Dune Encyclopedia", 1984, "eng"], ["Heretics of Dune", 1984, "eng"], ["Dune: House Atreides", 1999, "eng"], ["Chapterhouse: Dune", 1985, "eng"],
    ["Dune World", 1999, "eng"], ["God Emperor of Dune", 1981, "eng"],
  ]), /^dune$/i],
  ["el hobbit", openLibrary([
    ["The Hobbit", 1937, "eng"], ["El hobbit", 1964, "spa"], ["El Hobbit anotado", 1990, "spa"], ["The Hobbit, or There and Back Again", 1937, "eng"],
    ["Hobbit", 2012, "ger"], ["The Annotated Hobbit", 1988, "eng"], ["El hobbit: La desolación de Smaug (libro de la película)", 2013, "spa"],
    ["Der Hobbit", 1957, "ger"], ["Bilbo le Hobbit", 1969, "fre"], ["The Art of The Hobbit", 2011, "eng"],
  ]), /^el hobbit$/i],
  ["1984", openLibrary([
    ["Orwell's 1984: Study Guide", 1990, "eng"], ["Nineteen Eighty-Four", 1949, "eng"], ["1984", 1949, "spa"], ["1984 (Spanish edition)", 2013, "spa"],
    ["1984: Graphic Novel", 2021, "eng"], ["1985", 1978, "eng"], ["1984 Revisited", 1983, "eng"], ["George Orwell's 1984 (Bloom's Guides)", 2004, "eng"],
    ["Mil novecientos ochenta y cuatro", 1952, "spa"], ["1984. Rebelión en la granja", 2010, "spa"],
  ]), /^1984$/],
  ["el principito", openLibrary([
    ["Le Petit Prince", 1943, "fre"], ["El principito", 1951, "spa"], ["The Little Prince", 1943, "eng"], ["El principito (Spanish Edition)", 2000, "spa"],
    ["El principito para niños", 2015, "spa"], ["El principito y la rosa", 2018, "spa"], ["Il Piccolo Principe", 1949, "ita"],
    ["El principito: Edición ilustrada", 2019, "spa"], ["Der kleine Prinz", 1950, "ger"], ["El principito se pone la gorra", 2010, "spa"],
  ]), /^el principito$/i],
  ["sapiens", openLibrary([
    ["Homo sapiens", 1999, "eng"], ["Sapiens: A Brief History of Humankind", 2011, "eng"], ["Sapiens: De animales a dioses", 2014, "spa"],
    ["Sapiens: A Graphic History", 2020, "eng"], ["Homo Deus", 2015, "eng"], ["Sapiens and Stuff", 2001, "eng"], ["Sapientia", 1980, "lat"],
    ["The Sapiens Workbook", 2019, "eng"], ["Sapiens (edición gráfica)", 2020, "spa"], ["Sapiens Rising", 2017, "eng"],
  ]), /^sapiens:/i],
  ["fahrenheit 451", openLibrary([
    ["Ray Bradbury's Fahrenheit 451 (Graphic Adaptation)", 2009, "eng"], ["Fahrenheit 451", 1953, "eng"], ["Fahrenheit 451 (Spanish)", 1990, "spa"],
    ["Fahrenheit 451: Study Guide", 1998, "eng"], ["Fahrenheit 9/11", 2004, "eng"], ["Fahrenheit 452", 2017, "eng"], ["Bradbury's Fahrenheit", 2001, "eng"],
    ["The Fahrenheit Chronicles", 2010, "eng"], ["Fahrenheit 451 (Bloom's)", 2008, "eng"], ["451 grados", 1980, "spa"],
  ]), /^fahrenheit 451$/i],
  ["cien años de soledad", openLibrary([
    ["One Hundred Years of Solitude", 1967, "eng"], ["Cien años de soledad", 1967, "spa"], ["Cien años de soledad (edición conmemorativa)", 2007, "spa"],
    ["Hundert Jahre Einsamkeit", 1970, "ger"], ["Cent ans de solitude", 1968, "fre"], ["Cien años de soledad: guía de lectura", 1995, "spa"],
    ["Cien años de soledad (ilustrada)", 2017, "spa"], ["Cent'anni di solitudine", 1968, "ita"], ["Los cien años", 2000, "spa"],
    ["Soledad", 1990, "spa"],
  ]), /^cien años de soledad$/i],
  ["rayuela", openLibrary([
    ["Rayuela: edición crítica", 1991, "spa"], ["Rayuela", 1963, "spa"], ["Hopscotch", 1966, "eng"], ["Marelle", 1966, "fre"],
    ["Rayuela (Cátedra)", 1984, "spa"], ["La rayuela del tiempo", 2001, "spa"], ["Rayuelas", 2010, "spa"], ["Rayuela: guía", 2004, "spa"],
    ["Cortázar y Rayuela", 1985, "spa"], ["Rayuela 50 años", 2013, "spa"],
  ]), /^rayuela$/i],
];

// ── RAWG juegos ───────────────────────────────────────────────────────────────
type G = [name: string, year: number, ratings: number, image?: boolean];
function rawg(list: G[]) {
  return list.map(([name, year, ratings, image = true]) => {
    const id = nextId();
    return {
      id,
      name,
      released: `${year}-03-01`,
      background_image: image ? `https://media.rawg.io/media/games/${id}.jpg` : null,
      rating: ratings > 100 ? 4.4 : 3.1,
      ratings_count: ratings,
      metacritic: null,
      genres: [{ name: "Action" }],
    };
  });
}

export const GAME_CASES: [query: string, results: ReturnType<typeof rawg>, expected: RegExp | ((r: { title: string; year?: number }) => boolean)][] = [
  ["hollow knight", rawg([
    ["Hollow Knight: Silksong", 2025, 300], ["Hollow Knight", 2017, 3000], ["Hollow Knight: Voidheart Edition", 2019, 40],
    ["Hollow Knight: Godmaster", 2018, 60], ["Hollow", 2017, 10], ["Knight's Hollow", 2020, 2], ["Hollow Knight Demo", 2016, 5, false],
    ["Hollow Knight: Lifeblood", 2018, 30], ["Hollow Fields", 2021, 1], ["The Hollow Knight Fan Game", 2019, 1],
  ]), /^hollow knight$/i],
  ["hades", rawg([
    ["Hades II", 2024, 500], ["Hades", 2020, 3500], ["Hades' Star", 2016, 40], ["Hades Challenge", 1997, 3], ["Hadean Lands", 2014, 10],
    ["Hades Battleground", 2018, 1], ["Hades: Battle Out of Hell", 2004, 2], ["Hadeslayer", 2019, 1], ["Hade", 2021, 1], ["Hadesia", 2015, 1],
  ]), /^hades$/i],
  ["minecraft", rawg([
    ["Minecraft Dungeons", 2020, 900], ["Minecraft Legends", 2023, 200], ["Minecraft", 2009, 6000], ["Minecraft: Story Mode", 2015, 600],
    ["Minecraft Earth", 2019, 100], ["Minecraft: Pocket Edition", 2011, 300], ["Minecraft: Education Edition", 2016, 40],
    ["Minecraft: Story Mode - Season Two", 2017, 150], ["MineCraft Clone", 2018, 1], ["Minecraft 4K", 2009, 5],
  ]), /^minecraft$/i],
  ["baldur's gate 3", rawg([
    ["Baldur's Gate", 1998, 900], ["Baldur's Gate III", 2023, 2500], ["Baldur's Gate II: Shadows of Amn", 2000, 800],
    ["Baldur's Gate: Dark Alliance", 2001, 200], ["Baldur's Gate: Enhanced Edition", 2012, 300], ["Baldur's Gate: Siege of Dragonspear", 2016, 100],
    ["Baldur's Gate: Dark Alliance II", 2004, 120], ["Baldur's Gate 3 - Digital Deluxe", 2023, 20], ["Gate 3", 2019, 1], ["Baldur's Gate II: Enhanced Edition", 2013, 250],
  ]), /^baldur's gate iii$/i],
  ["portal 2", rawg([
    ["Portal", 2007, 5000], ["Portal 2", 2011, 5500], ["Portal Knights", 2016, 300], ["Portal 2 - The Final Hours", 2012, 30],
    ["Portal Stories: Mel", 2015, 400], ["Portal Reloaded", 2021, 100], ["Bridge Constructor Portal", 2017, 200], ["Portal 2: Sixense", 2012, 10],
    ["Portal: Still Alive", 2008, 150], ["Portal Pinball", 2015, 20],
  ]), /^portal 2$/i],
  ["celeste", rawg([
    ["Celeste Classic", 2015, 60], ["Celeste", 2018, 2000], ["Celestian Tales: Old North", 2015, 10], ["Celeste 64", 2024, 30],
    ["Celestial", 2020, 2], ["Celeste Classic 2", 2021, 15], ["Celestia", 2019, 1], ["Celestial Command", 2014, 1],
    ["Celeste Farewell", 2019, 20], ["Celeste: The Lost Levels", 2022, 1],
  ]), /^celeste$/i],
  ["elden ring", rawg([
    ["Elden Ring Nightreign", 2025, 300], ["Elden Ring", 2022, 5000], ["Elden Ring: Shadow of the Erdtree", 2024, 900],
    ["Elden Ring: Tarnished Edition", 2025, 10], ["Elden", 2016, 1], ["Ring of Elysium", 2018, 200], ["Elden Ring Network Test", 2021, 20],
    ["Elden Ring Seamless Coop", 2022, 2], ["Eldenwood", 2020, 1], ["Elden Ring: Colosseum", 2022, 3],
  ]), /^elden ring$/i],
  ["god of war", rawg([
    ["God of War Ragnarök", 2022, 1500], ["God of War", 2018, 6000], ["God of War", 2005, 2000], ["God of War III", 2010, 1800],
    ["God of War: Ascension", 2013, 900], ["God of War II", 2007, 1500], ["God of War: Chains of Olympus", 2008, 700],
    ["God of War: Ghost of Sparta", 2010, 600], ["God of War Ragnarök: Valhalla", 2023, 300], ["God of War: Betrayal", 2007, 50],
  ]), (r) => r.title === "God of War" && r.year === 2018],
  ["undertale", rawg([
    ["Undertale Yellow", 2023, 200], ["Undertale", 2015, 3500], ["Deltarune", 2018, 1500], ["Undertale: Last Breath", 2019, 5],
    ["Underhero", 2018, 40], ["Undertale Demo", 2013, 20, false], ["Underrail", 2015, 300], ["Undertow", 2007, 10],
    ["Underworld Ascendant", 2018, 80], ["Undertale Red", 2022, 2],
  ]), /^undertale$/i],
  ["stardew valley", rawg([
    ["Stardew Valley Expanded", 2020, 200], ["Stardew Valley", 2016, 4500], ["Stardew Valley Multiplayer", 2018, 10],
    ["Stardew Clone", 2021, 1], ["Haunted Chocolatier", 2026, 0, false], ["Sun Haven", 2023, 100], ["Coral Island", 2023, 200],
    ["Stardew Valley: Ridgeside", 2021, 5], ["Valley", 2016, 80], ["Star Valley", 2019, 1],
  ]), /^stardew valley$/i],
];
