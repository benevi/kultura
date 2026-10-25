import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { C, FORMAT_HEX, loadFont } from "@/lib/og/brand";
import { parseTitle } from "@/lib/landing/immersive";
import es from "../../../messages/es.json";

/**
 * Tarjeta que se ve al compartir el enlace (WhatsApp, X, Discord...).
 * D-11: la misma promesa que el h1 de la landing, con cada formato en su color
 * (como se ilumina en el hero) y "Gratis y sin anuncios" debajo. El
 * rasterizador de next/og no entiende OKLCH, así que los colores salen de la
 * tabla hex exacta de DISENO.md (`lib/og/brand`).
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * `alt` estático, para los segmentos que REEXPORTAN esta tarjeta (p. ej.
 * `login/opengraph-image.tsx`): la promesa en el idioma por defecto. En la
 * landing manda `generateImageMetadata`, que lo da traducido.
 */
export const alt: string = es.landing.seo.title;

/** `alt` traducido (SEO-6): con un `alt` estático salía "KULTURA" en los dos idiomas. */
type Params = { locale: string };

/**
 * `params` llega como objeto en Next 15 y como Promise en 16: se acepta lo uno
 * y lo otro (como en las demás tarjetas) para no depender de la versión.
 */
export async function generateImageMetadata({ params }: { params: Params | Promise<Params> }) {
  const locale = (await params).locale === "en" ? "en" : "es";
  const t = await getTranslations({ locale, namespace: "landing" });
  return [{ id: "card", alt: t("seo.title"), size, contentType }];
}

type Segment = { text: string; color: string };

/**
 * Palabra a palabra: satori parte las líneas por elemento, así el titular
 * envuelve como un texto normal y cada formato conserva su color. La
 * puntuación pegada a un formato ("cine,") va en la misma palabra, en blanco.
 */
function titleWords(title: ReturnType<typeof parseTitle>): Segment[][] {
  const words: Segment[][] = [];
  let glued = false; // el trozo anterior terminó sin espacio
  for (const part of title) {
    if (typeof part !== "string") {
      const seg = { text: part.text, color: FORMAT_HEX[part.type] };
      if (glued && words.length) words[words.length - 1].push(seg);
      else words.push([seg]);
      glued = true;
      continue;
    }
    const pieces = part.split(/(\s+)/).filter(Boolean);
    for (const piece of pieces) {
      if (/^\s+$/.test(piece)) {
        glued = false;
        continue;
      }
      const seg = { text: piece, color: C.text };
      if (glued && words.length) words[words.length - 1].push(seg);
      else words.push([seg]);
      glued = true;
    }
  }
  return words;
}

/** Lema corto bajo el titular: la última frase del subtítulo ("Gratis y sin anuncios."). */
function tail(sub: string): string {
  const parts = sub.split(". ").filter(Boolean);
  return parts[parts.length - 1] ?? sub;
}

export default async function Image({ params }: { params: Params | Promise<Params> }) {
  const locale = (await params).locale === "en" ? "en" : "es";
  const t = await getTranslations({ locale, namespace: "landing" });
  const title = parseTitle(t.raw("hero.title") as string);
  const lema = tail(t("hero.sub"));
  const words = titleWords(title);
  const glyphs = words.flatMap((w) => w.map((seg) => seg.text)).join("") + lema;
  const fonts = (
    await Promise.all([
      loadFont("Bricolage+Grotesque", 800, `kultura${glyphs}`),
      loadFont("Figtree", 700, lema),
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
          padding: "0 84px",
          background: `radial-gradient(120% 100% at 20% 10%, ${C.purpleGlow}, ${C.bg} 55%)`,
          color: C.text,
          fontFamily: "Figtree",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              background: C.surface2,
              display: "flex",
              position: "relative",
            }}
          >
            {[
              { c: C.pink, r: -10, t: 12, l: 9 },
              { c: C.lime, r: 6, t: 25, l: 22 },
              { c: C.purple, r: -4, t: 38, l: 14 },
            ].map((p) => (
              <div
                key={p.c}
                style={{
                  position: "absolute",
                  top: p.t,
                  left: p.l,
                  width: 32,
                  height: 21,
                  borderRadius: 9,
                  background: p.c,
                  transform: `rotate(${p.r}deg)`,
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", fontSize: 64, fontWeight: 800, letterSpacing: -2, fontFamily: "Bricolage Grotesque" }}>
            kultura
            <div style={{ width: 10, height: 10, background: C.lime, transform: "rotate(14deg)", marginLeft: 4, marginBottom: 16 }} />
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            columnGap: 22,
            marginTop: 36,
            fontSize: 76,
            lineHeight: 1,
            fontWeight: 800,
            letterSpacing: -2.5,
            fontFamily: "Bricolage Grotesque",
            maxWidth: 1032,
          }}
        >
          {words.map((word, i) => (
            <div key={i} style={{ display: "flex", marginBottom: 8 }}>
              {word.map((seg, j) => (
                <span key={j} style={{ color: seg.color }}>
                  {seg.text}
                </span>
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", fontSize: 34, fontWeight: 700, marginTop: 30, color: C.muted }}>{lema}</div>
      </div>
    ),
    { ...size, fonts },
  );
}
