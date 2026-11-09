/**
 * Fuente de imagen con los tamaños que da cada CDN: la portada central se ve a
 * unos 500 px y las miniaturas a 44, y sin esto todas pesarían como la central.
 * AniList pasa por el optimizador (sus PNG pesan hasta 560 KB) y son pocas portadas al mes.
 * Aparte de `shelf.ts` porque esto también corre en el navegador.
 */
export function coverSource(poster: string): { src: string; srcSet?: string } {
  const tmdb = /^(https:\/\/image\.tmdb\.org\/t\/p\/)w\d+(\/.+)$/.exec(poster);
  if (tmdb) {
    return {
      src: `${tmdb[1]}w500${tmdb[2]}`,
      srcSet: [185, 342, 500, 780].map((size) => `${tmdb[1]}w${size}${tmdb[2]} ${size}w`).join(", "),
    };
  }
  if (poster.startsWith("https://s4.anilist.co/")) {
    // Solo las `bx…` tienen versión grande: en las `b…` esa ruta da 404.
    const large = poster.replace(/\/cover\/(?:small|medium)\/(?=bx)/, "/cover/large/");
    const at = (size: number) => `/_next/image?url=${encodeURIComponent(large)}&w=${size}&q=75`;
    return { src: at(640), srcSet: [256, 384, 640].map((size) => `${at(size)} ${size}w`).join(", ") };
  }
  // Steam: «library_600x900» mide 300 × 450 y «_2x», 600 × 900.
  if (poster.includes("/library_600x900_2x.")) {
    return { src: poster, srcSet: `${poster.replace("_2x.", ".")} 300w, ${poster} 600w` };
  }
  const openLibrary = /^(https:\/\/covers\.openlibrary\.org\/.+)-L\.jpg$/.exec(poster);
  if (openLibrary) {
    return { src: poster, srcSet: `${openLibrary[1]}-M.jpg 180w, ${poster} 500w` };
  }
  return { src: poster };
}
