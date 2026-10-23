// ============================================================
// KULTURA — Idioma real de una sinopsis (WCAG 3.1.2)
//
// Sin sesión la ficha enseña la sinopsis original si nadie ha pagado aún su
// traducción (D-06), así que en `/es` puede salir un párrafo en inglés. Ese
// párrafo lleva `lang` con su idioma para que el lector de pantalla lo lea con
// la voz correcta. Solo se marca lo que se puede afirmar: si la detección no
// está segura (`unknown`), se deja con el idioma de la página.
// ============================================================

import { resolveApiLocale } from "@/lib/api/locale";
import { detectLanguage } from "@/lib/translate/language";

/** `lang` para el texto si su idioma es otro que el de la página; si no, `undefined`. */
export function synopsisLang(text: string | undefined | null, pageLocale: string): string | undefined {
  if (!text?.trim()) return undefined;
  const detected = detectLanguage(text);
  if (detected === "unknown") return undefined;
  return detected === resolveApiLocale(pageLocale) ? undefined : detected;
}
