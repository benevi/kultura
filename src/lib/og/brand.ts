// ============================================================
// KULTURA — Marca para las tarjetas de compartir (next/og)
// El rasterizador de next/og no entiende OKLCH, así que aquí van las
// aproximaciones hex de la tabla de tokens de DISENO.md; es la única excepción.
// ============================================================

export const C = {
  bg: "#1a1620",
  surface2: "#312c3c",
  text: "#f8f7fa",
  muted: "#a9a5b5",
  pink: "#e63b7d",
  lime: "#c4f037",
  orange: "#e8933c",
  purple: "#b83cc8",
  blue: "#4a7dd8",
  yellow: "#d4e03c",
};

/**
 * Las tipografías de la app (Bricolage + Figtree), recortadas a los glifos
 * que se usan. Si Google Fonts no responde, la tarjeta sale con la fuente por
 * defecto en vez de fallar: es mejor una tarjeta sin tipografía que ninguna.
 */
export async function loadFont(family: string, weight: number, text: string) {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${encodeURIComponent(text)}`,
    ).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\) format/)?.[1];
    if (!url) return null;
    const data = await fetch(url).then((r) => r.arrayBuffer());
    return { name: family.replace(/\+/g, " "), data, weight: weight as 700 | 800, style: "normal" as const };
  } catch {
    return null;
  }
}
