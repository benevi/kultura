import { ImageResponse } from "next/og";
import { C, loadFont } from "@/lib/og/brand";

/**
 * Tarjeta que se ve al compartir el enlace (WhatsApp, X, Discord...).
 * El rasterizador de next/og no entiende OKLCH, así que aquí van las
 * aproximaciones hex de la tabla de tokens; es la única excepción.
 */
export const alt = "KULTURA";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const COPY = {
  es: {
    tagline: "Todo lo que ves, lees y juegas, en un solo sitio.",
    formats: ["Películas", "Series", "Anime", "Libros", "Cómics", "Manga", "Juegos"],
  },
  en: {
    tagline: "Everything you watch, read and play, in one place.",
    formats: ["Movies", "Series", "Anime", "Books", "Comics", "Manga", "Games"],
  },
};

const CHIP_COLORS = [C.pink, C.lime, C.purple, C.orange, C.blue, C.yellow, C.pink];
const ON_DARK = "#1c1622";

export default async function Image({ params }: { params: { locale: string } }) {
  const copy = COPY[params.locale === "en" ? "en" : "es"];
  const body = [copy.tagline, ...copy.formats].join("");
  const fonts = (
    await Promise.all([
      loadFont("Bricolage+Grotesque", 800, "kultura"),
      loadFont("Figtree", 700, body),
    ])
  ).filter((f) => f !== null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 90px",
          background: `radial-gradient(120% 100% at 20% 10%, rgba(184,60,200,0.35), ${C.bg} 55%)`,
          color: C.text,
          fontFamily: "Figtree",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 40,
              background: C.surface2,
              display: "flex",
              position: "relative",
            }}
          >
            {[
              { c: C.pink, r: -10, t: 22, l: 18 },
              { c: C.lime, r: 6, t: 46, l: 42 },
              { c: C.purple, r: -4, t: 70, l: 26 },
            ].map((p) => (
              <div
                key={p.c}
                style={{
                  position: "absolute",
                  top: p.t,
                  left: p.l,
                  width: 60,
                  height: 40,
                  borderRadius: 18,
                  background: p.c,
                  transform: `rotate(${p.r}deg)`,
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", fontSize: 150, fontWeight: 800, letterSpacing: -4, fontFamily: "Bricolage Grotesque" }}>
            kultura
            <div
              style={{
                width: 22,
                height: 22,
                background: C.pink,
                transform: "rotate(14deg)",
                marginLeft: 8,
                marginBottom: 34,
              }}
            />
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 44, fontWeight: 700, marginTop: 28, color: C.text }}>
          {copy.tagline}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 44 }}>
          {copy.formats.map((f, i) => (
            <div
              key={f}
              style={{
                display: "flex",
                padding: "10px 20px",
                borderRadius: 999,
                background: CHIP_COLORS[i],
                color: ON_DARK,
                fontSize: 26,
                fontWeight: 700,
              }}
            >
              {f}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
