// ============================================================
// KULTURA — Títulos para puntuar en el onboarding (CRE-6, paso 3)
//
// Clásicos que casi todo el mundo ha visto, leído o jugado: para dar las
// primeras notas hacen falta títulos conocidos, no los estrenos de esta
// semana (que es lo que devuelve "popular" en los proveedores). Lista fija:
// se pinta al instante, sin una sola petición a proveedores, y la ficha real
// la escribe el servidor al puntuar (POST /api/library resuelve el id con el
// proveedor, así que el título y la portada de aquí son solo de escaparate).
//
// Ids y portadas sacados de /api/discover en producción el 2026-10-22. Sin
// cómics: la búsqueda de ComicVine no devolvía resultados (pendiente de F-13);
// quien elige solo cómic recibe el resto de formatos.
// ============================================================

import type { MediaType } from '@/types/media'

export interface StarterTitle {
  id: string
  type: MediaType
  year: number | null
  poster: string
  title: { es: string; en: string }
}

export const STARTER_TITLES: readonly StarterTitle[] = [
  { id: "movie_27205", type: 'movie', year: 2010, poster: "https://image.tmdb.org/t/p/w500/tXQvtRWfkUUnWJAn2tN3jERIUG.jpg", title: { es: "Origen", en: "Inception" } },
  { id: "movie_597", type: 'movie', year: 1997, poster: "https://image.tmdb.org/t/p/w500/2tltWMvvTqscFtdujTXDsRFTqKQ.jpg", title: { es: "Titanic", en: "Titanic" } },
  { id: "movie_120", type: 'movie', year: 2001, poster: "https://image.tmdb.org/t/p/w500/9xtH1RmAzQ0rrMBNUMXstb2s3er.jpg", title: { es: "El señor de los anillos: La comunidad del anillo", en: "The Lord of the Rings: The Fellowship of the Ring" } },
  { id: "movie_862", type: 'movie', year: 1995, poster: "https://image.tmdb.org/t/p/w500/jvn7wy3RSNEXnFSXLpH2of2LcV6.jpg", title: { es: "Toy Story", en: "Toy Story" } },
  { id: "movie_157336", type: 'movie', year: 2014, poster: "https://image.tmdb.org/t/p/w500/d1QKiYtceF3GDtxvTFXFAqwwah9.jpg", title: { es: "Interstellar", en: "Interstellar" } },
  { id: "movie_155", type: 'movie', year: 2008, poster: "https://image.tmdb.org/t/p/w500/8QDQExnfNFOtabLDKqfDQuHDsIg.jpg", title: { es: "El caballero oscuro", en: "The Dark Knight" } },
  { id: "movie_299534", type: 'movie', year: 2019, poster: "https://image.tmdb.org/t/p/w500/br6krBFpaYmCSglLBWRuhui7tPc.jpg", title: { es: "Vengadores: Endgame", en: "Avengers: Endgame" } },
  { id: "movie_354912", type: 'movie', year: 2017, poster: "https://image.tmdb.org/t/p/w500/vwsFGblLYxWBNjg9pdWN1Mm5YfW.jpg", title: { es: "Coco", en: "Coco" } },
  { id: "tv_1396", type: 'tv', year: 2008, poster: "https://image.tmdb.org/t/p/w500/anFx9aTOOYqgS3v7x3R84Kz67ly.jpg", title: { es: "Breaking Bad", en: "Breaking Bad" } },
  { id: "tv_1399", type: 'tv', year: 2011, poster: "https://image.tmdb.org/t/p/w500/3hDtRuwTfQQYRst3kjhvp4Cogjw.jpg", title: { es: "Juego de tronos", en: "Game of Thrones" } },
  { id: "tv_66732", type: 'tv', year: 2016, poster: "https://image.tmdb.org/t/p/w500/AsPD90QEQsIAtSxfSjV3fN7XFpt.jpg", title: { es: "Stranger Things", en: "Stranger Things" } },
  { id: "tv_1668", type: 'tv', year: 1994, poster: "https://image.tmdb.org/t/p/w500/rkKCSlr8OH5tbKEdgwtzvEiemrl.jpg", title: { es: "Friends", en: "Friends" } },
  { id: "tv_71446", type: 'tv', year: 2017, poster: "https://image.tmdb.org/t/p/w500/z01Dc0Ly2GmCpLe6Scx4d3dPP1S.jpg", title: { es: "La casa de papel", en: "Money Heist" } },
  { id: "tv_456", type: 'tv', year: 1989, poster: "https://image.tmdb.org/t/p/w500/9hmoEmntaYrrlb4HKSFisWUQnqy.jpg", title: { es: "Los Simpson", en: "The Simpsons" } },
  { id: "tv_93405", type: 'tv', year: 2021, poster: "https://image.tmdb.org/t/p/w500/g72YfmqUU0AlbDXRiYmDZWs28f7.jpg", title: { es: "El juego del calamar", en: "Squid Game" } },
  { id: "tv_2316", type: 'tv', year: 2005, poster: "https://image.tmdb.org/t/p/w500/5uwetbr0X8BPRy3Wmh63S9EhsiY.jpg", title: { es: "The Office", en: "The Office" } },
  { id: "anime_al-16498", type: 'anime', year: 2013, poster: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx16498-buvcRTBx4NSm.jpg", title: { es: "Ataque a los titanes", en: "Attack on Titan" } },
  { id: "anime_al-1535", type: 'anime', year: 2006, poster: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx1535-kUgkcrfOrkUM.jpg", title: { es: "Death Note", en: "Death Note" } },
  { id: "anime_al-101922", type: 'anime', year: 2019, poster: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx101922-WBsBl0ClmgYL.jpg", title: { es: "Guardianes de la noche (Kimetsu no Yaiba)", en: "Demon Slayer: Kimetsu no Yaiba" } },
  { id: "anime_al-21", type: 'anime', year: 1999, poster: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx21-ELSYx3yMPcKM.jpg", title: { es: "One Piece", en: "One Piece" } },
  { id: "anime_al-813", type: 'anime', year: 1989, poster: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx813-ZhnFNOeCU5dQ.png", title: { es: "Dragon Ball Z", en: "Dragon Ball Z" } },
  { id: "anime_al-20", type: 'anime', year: 2002, poster: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx20-dE6UHbFFg1A5.jpg", title: { es: "Naruto", en: "Naruto" } },
  { id: "anime_al-199", type: 'anime', year: 2001, poster: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx199-sWefXJvXkDOb.jpg", title: { es: "El viaje de Chihiro", en: "Spirited Away" } },
  { id: "anime_al-21519", type: 'anime', year: 2016, poster: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx21519-SUo3ZQuCbYhJ.png", title: { es: "Your Name.", en: "Your Name." } },
  { id: "manga_a1c7c817-4e59-43b7-9365-09675a149a6f", type: 'manga', year: 1997, poster: "https://uploads.mangadex.org/covers/a1c7c817-4e59-43b7-9365-09675a149a6f/2f4aca53-64c7-46ac-ae85-3bc9b3169890.png", title: { es: "One Piece", en: "One Piece" } },
  { id: "manga_801513ba-a712-498c-8f57-cae55b38cc92", type: 'manga', year: 1989, poster: "https://uploads.mangadex.org/covers/801513ba-a712-498c-8f57-cae55b38cc92/81e1c82d-6672-400c-8c58-4ff9bfb89031.jpg", title: { es: "Berserk", en: "Berserk" } },
  { id: "manga_40bc649f-7b49-4645-859e-6cd94136e722", type: 'manga', year: 1984, poster: "https://uploads.mangadex.org/covers/40bc649f-7b49-4645-859e-6cd94136e722/b048eb82-670b-4b41-9fc1-38bf7dd52159.jpg", title: { es: "Dragon Ball", en: "Dragon Ball" } },
  { id: "manga_75ee72ab-c6bf-4b87-badd-de839156934c", type: 'manga', year: 2003, poster: "https://uploads.mangadex.org/covers/75ee72ab-c6bf-4b87-badd-de839156934c/d6555598-8202-477d-acde-303202cb3475.jpg", title: { es: "Death Note", en: "Death Note" } },
  { id: "manga_a77742b1-befd-49a4-bff5-1ad4e6b0ef7b", type: 'manga', year: 2018, poster: "https://uploads.mangadex.org/covers/a77742b1-befd-49a4-bff5-1ad4e6b0ef7b/6e518bd1-5f60-446b-8832-bfe6bf74834b.jpg", title: { es: "Chainsaw Man", en: "Chainsaw Man" } },
  { id: "manga_dd8a907a-3850-4f95-ba03-ba201a8399e3", type: 'manga', year: 2001, poster: "https://uploads.mangadex.org/covers/dd8a907a-3850-4f95-ba03-ba201a8399e3/a9cd0207-1b86-4738-a2b5-3575c32d5315.jpg", title: { es: "Fullmetal Alchemist", en: "Fullmetal Alchemist" } },
  { id: "manga_319df2e2-e6a6-4e3a-a31c-68539c140a84", type: 'manga', year: 1990, poster: "https://uploads.mangadex.org/covers/319df2e2-e6a6-4e3a-a31c-68539c140a84/a845455f-52d0-4cc4-92a8-bd5bad7d69b9.jpg", title: { es: "Slam Dunk", en: "Slam Dunk" } },
  { id: "book_OL82563W", type: 'book', year: 1997, poster: "https://covers.openlibrary.org/b/id/15155833-L.jpg", title: { es: "Harry Potter y la piedra filosofal", en: "Harry Potter and the Philosopher's Stone" } },
  { id: "book_OL1168083W", type: 'book', year: 1949, poster: "https://covers.openlibrary.org/b/id/9267242-L.jpg", title: { es: "1984", en: "Nineteen Eighty-Four" } },
  { id: "book_OL27482W", type: 'book', year: 1937, poster: "https://covers.openlibrary.org/b/id/14627509-L.jpg", title: { es: "El hobbit", en: "The Hobbit" } },
  { id: "book_OL503666W", type: 'book', year: 1600, poster: "https://covers.openlibrary.org/b/id/14428305-L.jpg", title: { es: "Don Quijote de la Mancha", en: "Don Quixote" } },
  { id: "book_OL274505W", type: 'book', year: 1967, poster: "https://covers.openlibrary.org/b/id/12627383-L.jpg", title: { es: "Cien años de soledad", en: "One Hundred Years of Solitude" } },
  { id: "book_OL5735363W", type: 'book', year: 2008, poster: "https://covers.openlibrary.org/b/id/12646537-L.jpg", title: { es: "Los juegos del hambre", en: "The Hunger Games" } },
  { id: "book_OL10263W", type: 'book', year: 1943, poster: "https://covers.openlibrary.org/b/id/10708272-L.jpg", title: { es: "El principito", en: "The Little Prince" } },
  { id: "book_OL893414W", type: 'book', year: 1965, poster: "https://covers.openlibrary.org/b/id/11481354-L.jpg", title: { es: "Dune", en: "Dune" } },
  { id: "game_22511", type: 'game', year: 2017, poster: "https://media.rawg.io/media/games/cc1/cc196a5ad763955d6532cdba236f730c.jpg", title: { es: "The Legend of Zelda: Breath of the Wild", en: "The Legend of Zelda: Breath of the Wild" } },
  { id: "game_22509", type: 'game', year: 2009, poster: "https://media.rawg.io/media/games/b4e/b4e4c73d5aa4ec66bbf75375c4847a2b.jpg", title: { es: "Minecraft", en: "Minecraft" } },
  { id: "game_3498", type: 'game', year: 2013, poster: "https://media.rawg.io/media/games/20a/20aa03a10cda45239fe22d035c0ebe64.jpg", title: { es: "Grand Theft Auto V", en: "Grand Theft Auto V" } },
  { id: "game_3328", type: 'game', year: 2015, poster: "https://media.rawg.io/media/games/618/618c2031a07bbff6b4f611f10b6bcdbc.jpg", title: { es: "The Witcher 3: Wild Hunt", en: "The Witcher 3: Wild Hunt" } },
  { id: "game_28", type: 'game', year: 2018, poster: "https://media.rawg.io/media/games/511/5118aff5091cb3efec399c808f8c598f.jpg", title: { es: "Red Dead Redemption 2", en: "Red Dead Redemption 2" } },
  { id: "game_28026", type: 'game', year: 2017, poster: "https://media.rawg.io/media/games/267/267bd0dbc496f52692487d07d014c061.jpg", title: { es: "Super Mario Odyssey", en: "Super Mario Odyssey" } },
  { id: "game_4200", type: 'game', year: 2011, poster: "https://media.rawg.io/media/games/2ba/2bac0e87cf45e5b508f227d281c9252a.jpg", title: { es: "Portal 2", en: "Portal 2" } },
  { id: "game_326243", type: 'game', year: 2022, poster: "https://media.rawg.io/media/games/b29/b294fdd866dcdb643e7bab370a552855.jpg", title: { es: "Elden Ring", en: "Elden Ring" } },
]

/** Cuántos títulos se enseñan para puntuar. */
export const STARTER_RATE_COUNT = 10

/** Notas que hacen falta para las primeras recomendaciones (MIN_LIBRARY_ITEMS). */
export const STARTER_MIN_RATINGS = 3

/**
 * Los `count` títulos que se enseñan: primero los de los formatos elegidos,
 * alternando formato para que no salgan diez películas seguidas, y si no
 * llegan, se completa con el resto (mismo orden).
 */
export function pickStarterTitles(
  formats: readonly MediaType[],
  count = STARTER_RATE_COUNT,
): StarterTitle[] {
  const chosen = new Set(formats)
  const byType = new Map<MediaType, StarterTitle[]>()
  for (const title of STARTER_TITLES) {
    const bucket = byType.get(title.type) ?? []
    bucket.push(title)
    byType.set(title.type, bucket)
  }
  const roundRobin = (types: MediaType[]): StarterTitle[] => {
    const lists = types.map((t) => byType.get(t) ?? [])
    const out: StarterTitle[] = []
    const longest = lists.reduce((m, l) => Math.max(m, l.length), 0)
    for (let i = 0; i < longest; i++) for (const l of lists) if (i < l.length) out.push(l[i])
    return out
  }
  const allTypes = Array.from(byType.keys())
  const preferred = roundRobin(allTypes.filter((t) => chosen.has(t)))
  const rest = roundRobin(allTypes.filter((t) => !chosen.has(t)))
  return [...preferred, ...rest].slice(0, count)
}
