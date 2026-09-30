// ============================================================
// KULTURA — Editoriales del catálogo de cómic (E-COMIC-ALLOWLIST)
//
// Aquí vive la ÚNICA decisión de "¿este issue entra en el catálogo de cómic?".
// Estaba dentro de `comicvine.ts` como dos listas negras (manga + adulto) y el
// problema no era qué contenían, sino su forma: **por defecto aceptaban**. Una
// editorial que no estuviera enumerada pasaba, así que cada hueco se descubría
// en pantalla y se tapaba añadiendo un nombre más. Con la página 100 de
// Descubrir → Cómics (offset 29.700) salía el catálogo entero en manga, hentai
// explícito incluido.
//
// Ahora la puerta es **por defecto deniega**: solo entra el publisher que
// figura en `COMIC_PUBLISHERS` (lista blanca). Las listas negras SIGUEN vivas
// como veto posterior, y no es redundancia: resuelven los sellos cuyo nombre
// contiene el de una editorial permitida ("Dark Horse Manga" dentro de "Dark
// Horse", "Glénat Manga" dentro de "Glénat", "Fantagraphics Eros" dentro de
// "Fantagraphics"). Lista blanca primero, veto después.
//
// Contrapartida asumida: una editorial legítima que no esté en la lista queda
// fuera del catálogo. Es el lado correcto en el que fallar — antes el fallo por
// omisión era dejar entrar porno.
// ============================================================

/**
 * Normaliza un nombre de editorial a "palabras separadas por un espacio":
 * minúsculas, sin diacríticos, y cualquier tirada de caracteres no
 * alfanuméricos convertida en UN espacio.
 *
 * Los diacríticos se quitan porque ComicVine mezcla las dos grafías de la misma
 * casa ("Glénat" / "Glenat", "Les Humanoïdes Associés" / "Humanoides"), y la
 * puntuación se colapsa porque "BOOM! Studios" y "Boom Studios" son la misma
 * editorial.
 */
function normalizePublisher(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * ¿Aparece `entry` como secuencia COMPLETA de palabras dentro de `name`?
 *
 * No es substring crudo, y la diferencia importa: con substring, la entrada
 * "DC" casa con "Hardcover" ("har-DC-over") y colaría cualquier editorial con
 * esas dos letras seguidas. Comparando con espacios a los lados, "dc" casa con
 * "DC Comics" y no con "Hardcover". Es la misma política anti-falsos-positivos
 * que ya usa el filtro NSFW con sus `\b`.
 */
function matchesPublisherEntry(name: string, entry: string): boolean {
  return ` ${normalizePublisher(name)} `.includes(` ${normalizePublisher(entry)} `);
}

/**
 * Editoriales admitidas en el catálogo de cómic: EE. UU. + Reino Unido + BD
 * franco-belga + España y LatAm + Italia + clásicos. El manga tiene su propio
 * apartado (MangaDex) y no entra aquí.
 *
 * Cada entrada se compara como secuencia de palabras (ver
 * `matchesPublisherEntry`), así que "Marvel" cubre "Marvel Comics", "Marvel
 * UK" y "Marvel Knights" sin tener que enumerarlos.
 */
export const COMIC_PUBLISHERS: string[] = [
  // ── EE. UU. — grandes y medianas ──
  "Marvel",
  "DC",
  "DC Comics",
  "Image",
  "Dark Horse",
  "IDW",
  "BOOM",
  "Dynamite",
  "Valiant",
  "Vertigo",
  "Oni Press",
  "Archie",
  "AfterShock",
  "Vault",
  "AWA",
  "Mad Cave",
  "Scout Comics",
  "Ablaze",
  "Black Mask",
  "Zenescope",
  "Skybound",
  "Boom Entertainment",
  "Legendary",
  "Bad Idea",
  "Massive",
  "Source Point Press",
  "Antarctic Press",
  // ── EE. UU. — novela gráfica / infantil / indie de autor ──
  "Fantagraphics",
  "Drawn and Quarterly",
  "Drawn & Quarterly",
  "Top Shelf",
  "First Second",
  "Abrams",
  "Papercutz",
  "Graphix",
  "Scholastic",
  "Andrews McMeel",
  "Silver Sprocket",
  "Uncivilized",
  "Koyama Press",
  "Nobrow",
  "Iron Circus",
  // ── EE. UU. — clásicos y sellos históricos ──
  "EC Comics",
  "Charlton",
  "Gold Key",
  "Harvey",
  "Dell",
  "Fawcett",
  "Quality Comics",
  "Eclipse",
  "First Comics",
  "Malibu",
  "WildStorm",
  "CrossGen",
  "Comico",
  "Topps",
  "Acclaim",
  "Defiant",
  "Milestone",
  "Epic",
  "Now Comics",
  "Continuity",
  "Whitman",
  "King Features",
  "MAD",
  // ── Reino Unido ──
  "2000 AD",
  "Rebellion",
  "Titan",
  "Panini",
  "Egmont",
  "DC Thomson",
  "IPC",
  "Fleetway",
  "SelfMadeHero",
  "Jonathan Cape",
  // ── BD franco-belga ──
  "Dargaud",
  "Dupuis",
  "Casterman",
  "Le Lombard",
  "Lombard",
  "Delcourt",
  "Soleil",
  "Glenat",
  "Humanoides Associes",
  "Les Humanoides Associes",
  "Bamboo",
  "Ankama",
  "Rue de Sevres",
  "Gallimard",
  "Futuropolis",
  "Cornelius",
  "Albert Rene",
  "Media Participations",
  "Vents d Ouest",
  "Bayard",
  // ── España y LatAm ──
  "Norma Editorial",
  "Planeta",
  "Planeta DeAgostini",
  "ECC Ediciones",
  "Astiberri",
  "Bruguera",
  "Ediciones B",
  "Salvat",
  "Novaro",
  "Editorial Vid",
  "Dibbuks",
  "Sins Entido",
  "Reservoir Books",
  "Random House",
  "Ivrea", // NOTA: Ivrea publica manga en ES/AR; el veto de manga no lo cubre
  // ── Italia ──
  "Sergio Bonelli",
  "Bonelli",
  "Astorina",
  "Editoriale Cosmo",
  "Rizzoli",
  "Coconino",
  // ── Resto de Europa ──
  "Splitter",
  "Reprodukt",
  "Avant",
  "Oog en Blik",
  "Standaard Uitgeverij",
];

/**
 * Editoriales de manga. Ya NO son la puerta del catálogo (eso es
 * `COMIC_PUBLISHERS`), sino el VETO que desempata los sellos cuyo nombre
 * contiene el de una editorial permitida: "Dark Horse Manga" pasa la lista
 * blanca por "Dark Horse" y tiene que caer aquí.
 *
 * Incluye las grandes japonesas, sus sellos occidentales de manga traducido y
 * las principales coreanas (manhwa) y chinas (manhua), que también tienen
 * tratamiento aparte fuera de este catálogo.
 */
export const MANGA_PUBLISHERS: string[] = [
  // Japón — grandes editoriales
  "Shueisha",
  "Kodansha",
  "Shogakukan",
  "Kadokawa",
  "Square Enix",
  "Hakusensha",
  "Akita Shoten",
  "Futabasha",
  "Houbunsha",
  "Ichijinsha",
  "Coamix",
  "Takeshobo",
  "Shinchosha",
  "Enterbrain",
  "Mag Garden",
  "Media Factory",
  "Flex Comix",
  "Bunkasha",
  "Libre",
  "Tokuma Shoten",
  "Hobby Japan",
  "Gentosha",
  "Leed",
  "Nihon Bungeisha",
  "Kaiohsha",
  "Ohzora",
  "Jive",
  "Frontier Works",
  "Comicsmart",
  "Kill Time Communication",
  "Wani Books",
  "Tobido",
  "Seibido",
  // Sellos/editoriales occidentales que publican manga traducido
  "Viz",
  "Yen Press",
  "Seven Seas",
  "Kodansha USA",
  "Kodansha Comics",
  "Dark Horse Manga",
  "Tokyopop",
  "Vertical",
  "Denpa",
  "J-Novel",
  "Digital Manga",
  "Glenat Manga",
  "Norma Manga",
  "Panini Manga",
  "Planeta Manga",
  "Ivrea Manga",
  // Manhwa (Corea) y manhua (China) — fuera del catálogo de cómic occidental
  "Webtoon",
  "Naver",
  "Daewon",
  "Haksan",
  "Lezhin",
  "Kakao",
  "Tappytoon",
  "Tapas",
  "D&C Media",
  "Redice",
  "Bilibili",
  "Tencent",
  "Kuaikan",
];

/**
 * Sellos de cómic erótico o pornográfico. Igual que el de manga, ahora es un
 * VETO y no la puerta: su trabajo es tumbar el sello adulto que hereda el
 * nombre de una editorial permitida ("Fantagraphics Eros" dentro de
 * "Fantagraphics", "NBM Amerotica" dentro de... nada, pero se conserva por si
 * la lista blanca crece).
 *
 * Nombres verificados contra el endpoint /publishers/ de ComicVine.
 */
export const ADULT_PUBLISHERS: string[] = [
  "Eros Comix",
  "Amerotica",
  "NBM Amerotica",
  "Last Gasp",
  "Fantagraphics Eros",
  "Fantagraphics Underground",
  "FAKKU",
  "Project H",
  "Adult Comics",
  "Hentai",
  "Erotic",
  "Erotica",
  "Penthouse Comix",
  "Playboy",
  "Hustler",
  "Sizzle",
  "Class Comics",
  "Bruno Gmunder",
  "NQ Publishers",
  "Slipshine",
  // Editoriales japonesas de ero-manga (E87 — verificadas en la API de ComicVine).
  "Bunendo", // id 7358 — Comic Bavel (caso que motivó E87)
  "Wani Magazine", // id 3559 — "various ero-manga and art books"
  "Akaneshinsha", // id 3495 — "various adult manga brands"
  "Sanwa Publishing", // id 4931 — "adult manga titles"
  "Coremagazine", // id 3631 — Comic Hotmilk y otros hentai
  "Kasakura", // id 8301 (Kasakura Shuppansha) — ero-manga
  "Mediax", // id 7768 — ero-manga (Honey Dip, etc.)
  "Hit Publishing", // id 3566 — Comic Aun y otros ero-manga
  "Angel Club", // E-COMIC-ALLOWLIST — visto en la página 100 de Descubrir
];

/** True si la editorial figura en la lista blanca del catálogo de cómic. */
export function isAllowedComicPublisher(name: string): boolean {
  if (!name) return false;
  return COMIC_PUBLISHERS.some((p) => matchesPublisherEntry(name, p));
}

/** True si el nombre de editorial corresponde a una casa de manga/manhwa/manhua. */
export function isMangaPublisher(name: string): boolean {
  if (!name) return false;
  return MANGA_PUBLISHERS.some((p) => matchesPublisherEntry(name, p));
}

/** True si el nombre de editorial corresponde a un sello adulto/erótico. */
export function isAdultPublisher(name: string): boolean {
  if (!name) return false;
  return ADULT_PUBLISHERS.some((p) => matchesPublisherEntry(name, p));
}

/**
 * La decisión completa: ¿entra este publisher en el catálogo de cómic?
 *
 * Lista blanca primero (por defecto deniega), veto después. El orden es lo que
 * resuelve "Dark Horse Manga": pasa la lista blanca y lo tumba el veto.
 */
export function acceptsComicPublisher(name: string): boolean {
  if (!isAllowedComicPublisher(name)) return false;
  return !isMangaPublisher(name) && !isAdultPublisher(name);
}
