import { ImageResponse } from "next/og";
import { C, loadFont } from "@/lib/og/brand";
import { posterDataUri } from "@/lib/og/poster";
import { getBestOf, parseBestParams, type BestFormat } from "@/lib/best/best-of";

/**
 * Tarjeta al compartir un ranking (/best/{formato}/{año}): título y las tres
 * primeras portadas en abanico. Igual que la de /u, NUNCA depende de que el
 * proveedor responda: sin datos, salen los gradientes de respaldo.
 */
export const alt = "KULTURA";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const POSTER_W = 230;
const POSTER_H = 345;
const FALLBACKS = [
  "linear-gradient(155deg, #e63b7d, #6e1f42)",
  "linear-gradient(155deg, #b83cc8, #4f1a5a)",
  "linear-gradient(155deg, #4a7dd8, #1f3766)",
];
const TILT = [-7, 2, 8];

const TITLES: Record<"es" | "en", Record<BestFormat, string>> = {
  es: {
    anime: "Los mejores animes de",
    movie: "Las mejores películas de",
    tv: "Las mejores series de",
    game: "Los mejores videojuegos de",
  },
  en: {
    anime: "Best anime of",
    movie: "Best movies of",
    tv: "Best TV series of",
    game: "Best video games of",
  },
};
const BADGE = { es: "Ranking", en: "Ranking" };

type Params = { locale: string; format: string; year: string };

export default async function Image({ params }: { params: Params | Promise<Params> }) {
  const { locale, format, year } = await params;
  const l = locale === "en" ? "en" : "es";
  const parsed = parseBestParams(format, year);
  const heading = parsed ? TITLES[l][parsed.format] : "KULTURA";
  const yearLabel = parsed ? String(parsed.year) : "";

  const items = parsed ? await getBestOf(parsed.format, parsed.year, l).catch(() => []) : [];
  // Abanico con el #1 en el centro (el más alto).
  const fan = [items[1], items[0], items[2]].filter(Boolean);
  const posters = await Promise.all(fan.map((i) => posterDataUri(i.poster)));
  while (posters.length < 3) posters.push(null);
  const top = items[0]?.title ?? "";

  const fonts = (
    await Promise.all([
      loadFont("Bricolage+Grotesque", 800, `kultura${heading}${yearLabel}`),
      loadFont("Figtree", 700, `${BADGE[l]}#1${top}`),
    ])
  ).filter((f) => f !== null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 70px 0 80px",
          background: `radial-gradient(120% 100% at 15% 10%, rgba(196,240,55,0.22), ${C.bg} 55%)`,
          color: C.text,
          fontFamily: "Figtree",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 560 }}>
          <div style={{ display: "flex", alignItems: "flex-end", fontSize: 44, fontWeight: 800, fontFamily: "Bricolage Grotesque" }}>
            kultura
            <div style={{ width: 9, height: 9, background: C.pink, transform: "rotate(14deg)", marginLeft: 4, marginBottom: 10 }} />
          </div>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              marginTop: 48,
              padding: "8px 20px",
              borderRadius: 999,
              background: C.lime,
              color: "#1c1622",
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            {BADGE[l]}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 58,
              fontWeight: 800,
              letterSpacing: -2,
              lineHeight: 1.02,
              marginTop: 18,
              fontFamily: "Bricolage Grotesque",
            }}
          >
            {heading}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 120,
              fontWeight: 800,
              letterSpacing: -4,
              lineHeight: 1,
              color: C.lime,
              fontFamily: "Bricolage Grotesque",
            }}
          >
            {yearLabel}
          </div>
          {top && (
            <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: C.muted, marginTop: 18 }}>
              {`#1 ${top.length > 38 ? `${top.slice(0, 37)}…` : top}`}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          {posters.map((uri, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                width: POSTER_W,
                height: POSTER_H,
                marginLeft: i === 0 ? 0 : -95,
                marginTop: i === 1 ? -50 : 40,
                borderRadius: 18,
                overflow: "hidden",
                background: FALLBACKS[i],
                transform: `rotate(${TILT[i]}deg)`,
                boxShadow: `10px 10px 0 ${C.surface2}`,
              }}
            >
              {uri && (
                // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
                <img src={uri} width={POSTER_W} height={POSTER_H} style={{ objectFit: "cover" }} />
              )}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
