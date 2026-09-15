// ============================================================
// KULTURA — Limpieza de subjects y descripción de Open Library (E-BOOKS-SUBJ)
//
// Open Library no tiene un catálogo cerrado de géneros: `subject` es texto
// libre aportado por la comunidad y por volcados de catálogos de bibliotecas.
// En la misma lista conviven géneros de verdad ("Fiction", "Romance"), lugares
// y temas sueltos ("Beaches", "New York"), metadatos de archivo ("Accessible
// book", "Protected DAISY", "In library") y, en los libros autopublicados de
// relleno, una sola cadena con toda la ficha de marketing dentro.
//
// Eso rompía dos cosas a la vez:
//   - El MATCH salía 0% en todos los libros. `slice(0, 5)` se quedaba con los
//     cinco primeros subjects, que suelen ser los ruidosos, así que al
//     canonizarlos no quedaba ningún género y la afinidad por género era cero.
//   - La FICHA pintaba "Beaches" como género de una novela romántica, o un
//     párrafo entero de palabras clave dentro de un chip.
//
// Aquí se ordenan los subjects poniendo delante los que el vocabulario
// canónico reconoce como género, y se descarta el ruido evidente. No se
// inventa ningún género: si un libro no trae ninguno reconocible, se quedan
// sus subjects menos ruidosos, que es información real aunque no puntúe.
// ============================================================

import { canonicalGenres } from "@/lib/recommendations/genre-canonical";

/** Cuántos subjects se conservan como `genres` del ítem. */
const MAX_SUBJECTS = 5;

/**
 * Longitud a partir de la cual un subject deja de ser un tema y pasa a ser un
 * volcado de palabras clave. Los géneros reales son cortos ("Juvenile
 * fiction"); lo que llega a 60 caracteres es relleno de autopublicación.
 */
const MAX_SUBJECT_LENGTH = 60;

/**
 * Metadatos de archivo y catalogación que Open Library mezcla con los temas.
 * No describen el libro, describen su ficha o su disponibilidad.
 */
const NOISE_SUBJECTS = new Set([
  "accessible book",
  "protected daisy",
  "in library",
  "overdrive",
  "internet archive wishlist",
  "large type books",
  "open library staff picks",
  "reading level",
  "lending library",
  "popular print disabled books",
  "ebook",
  "textbooks",
]);

function isNoise(subject: string): boolean {
  const s = subject.trim().toLowerCase();
  if (s.length === 0) return true;
  if (s.length > MAX_SUBJECT_LENGTH) return true;
  if (NOISE_SUBJECTS.has(s)) return true;
  // Etiquetas de catálogo tipo "nyt:bestseller=2011-01-01" o "lc:PZ7".
  if (/^[a-z]{2,4}:/.test(s)) return true;
  // Una cadena con varias barras verticales es una lista de palabras clave
  // metida en un solo subject, no un tema.
  if ((s.match(/\|/g) ?? []).length >= 2) return true;
  return false;
}

/**
 * Devuelve los subjects más útiles de un libro: primero los que el vocabulario
 * canónico reconoce como género (los que hacen que el match puntúe), después
 * el resto de temas limpios.
 */
export function pickBookSubjects(
  subjects: string[] | undefined | null
): string[] | undefined {
  if (!subjects?.length) return undefined;

  const clean = subjects.filter((s) => typeof s === "string" && !isNoise(s));
  if (clean.length === 0) return undefined;

  const recognised: string[] = [];
  const rest: string[] = [];
  for (const subject of clean) {
    (canonicalGenres([subject]).length > 0 ? recognised : rest).push(subject);
  }

  const picked = [...recognised, ...rest].slice(0, MAX_SUBJECTS);
  return picked.length > 0 ? picked : undefined;
}

/**
 * Limpia la descripción de un work.
 *
 * Open Library guarda las descripciones en texto plano, pero mucha gente pega
 * Markdown con los asteriscos escapados (`\*\*Title:\*\*`), y los libros
 * autopublicados de relleno pegan la ficha entera —título, subtítulo, autor,
 * editorial— en vez de una sinopsis. Lo primero se puede arreglar; lo segundo
 * no, así que al menos se entrega legible.
 */
export function cleanOpenLibraryDescription(
  description: string | undefined | null
): string | undefined {
  if (!description) return undefined;

  const cleaned = description
    // Escapes de Markdown: `\*`, `\-`, `\_`… sobran en texto plano.
    .replace(/\\([*_\-#[\]()])/g, "$1")
    // Énfasis de Markdown que nadie va a renderizar aquí.
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|$)/g, "$1$2")
    // Separadores horizontales sueltos al principio.
    .replace(/^\s*-{3,}\s*/, "")
    // Enlaces de Open Library al final ("([source][1])").
    .replace(/\(\[source\]\[\d+\]\)/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned.length > 0 ? cleaned : undefined;
}
