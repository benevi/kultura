import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { loadFont, fontsOption } from "@/lib/og/brand";
import es from "../../../messages/es.json";
import en from "../../../messages/en.json";

/**
 * Tarjeta que se ve al compartir el enlace (WhatsApp, X, Discord...): la tapa
 * del álbum. Campo cian de imprenta con el titular de la portada en Lilita
 * One y tinta marina, el lema («Gratis y sin anuncios.») y, a la derecha, una
 * página blanca con sus huecos numerados de contorno discontinuo. Sin
 * portadas: la tarjeta no depende de ningún proveedor. El rasterizador de
 * next/og no entiende OKLCH: los colores son los hex exactos de DISENO.md.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Tintas del álbum (tabla de DISENO.md). */
const INK = { cyan: "#00a0e3", navy: "#0b2a6b", white: "#ffffff", pink: "#ff2d8a" };

/**
 * `alt` estático, para los segmentos que REEXPORTAN esta tarjeta (p. ej.
 * `login/opengraph-image.tsx`): la promesa en el idioma por defecto. En la
 * landing manda `generateImageMetadata`, que lo da traducido.
 */
export const alt: string = es.landing.seo.title;

type Params = { locale: string };

/**
 * `alt` traducido (SEO-6). Next 15 resuelve `generateImageMetadata` en una
 * capa donde `next-intl/server` no está disponible, así que el texto se lee
 * directamente de los mensajes. `params` llega como objeto en Next 15 y como
 * Promise en 16: se aceptan los dos.
 */
export async function generateImageMetadata({ params }: { params: Params | Promise<Params> }) {
  const locale = (await params).locale === "en" ? "en" : "es";
  const messages = locale === "en" ? en : es;
  return [{ id: "card", alt: messages.landing.seo.title, size, contentType }];
}

/** Lema corto: la última frase del subtítulo («Gratis y sin anuncios.»). */
function tail(sub: string): string {
  const parts = sub.split(". ").filter(Boolean);
  return parts[parts.length - 1] ?? sub;
}

/** Hueco numerado: contorno discontinuo de 2 px y el número arriba a la izquierda. */
function Slot({ n, w, h }: { n: number; w: number; h: number }) {
  return (
    <div style={{ display: "flex", position: "relative", width: w, height: h }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", top: 0, left: 0 }}>
        <rect
          x="1.5"
          y="1.5"
          width={w - 3}
          height={h - 3}
          rx="4"
          fill="none"
          stroke={INK.navy}
          strokeOpacity="0.45"
          strokeWidth="3"
          strokeDasharray="10 7"
        />
      </svg>
      <div style={{ display: "flex", position: "absolute", top: 8, left: 12, fontSize: 26, color: INK.navy, fontFamily: "Lilita One" }}>
        {String(n)}
      </div>
    </div>
  );
}

export default async function Image({ params }: { params: Params | Promise<Params> }) {
  const locale = (await params).locale === "en" ? "en" : "es";
  const t = await getTranslations({ locale, namespace: "landing" });
  const title = t("hero.title");
  const lema = tail(t("hero.sub"));
  const fonts = (
    await Promise.all([
      loadFont("Lilita+One", 400, `${title}0123456789`),
      loadFont("Bricolage+Grotesque", 700, "kultura"),
      loadFont("Figtree", 700, lema),
    ])
  ).filter((f) => f !== null);

  const slotW = 80;
  const slotH = 120;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: INK.cyan,
          color: INK.navy,
          fontFamily: "Figtree",
          padding: "64px 0 64px 72px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 640 }}>
          <div style={{ display: "flex", alignItems: "flex-end", fontSize: 52, fontWeight: 700, letterSpacing: -1.5, fontFamily: "Bricolage Grotesque" }}>
            kultura
            <div style={{ width: 10, height: 10, borderRadius: 999, background: INK.pink, marginLeft: 4, marginBottom: 12 }} />
          </div>
          <div style={{ display: "flex", fontSize: 76, lineHeight: 1.02, fontFamily: "Lilita One" }}>{title}</div>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 700 }}>{lema}</div>
        </div>
        {/* La página derecha del álbum: blanca, con raya de tinta y huecos. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            marginLeft: 56,
            padding: "28px 28px",
            background: INK.white,
            border: `3px solid ${INK.navy}`,
            borderRight: "none",
            borderRadius: "16px 0 0 16px",
            flex: 1,
          }}
        >
          {[0, 1].map((row) => (
            <div key={row} style={{ display: "flex", gap: 16, marginTop: row ? 18 : 0 }}>
              {[1, 2, 3, 4].map((col) => (
                <Slot key={col} n={row * 4 + col} w={slotW} h={slotH} />
              ))}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size, ...fontsOption(fonts) },
  );
}
