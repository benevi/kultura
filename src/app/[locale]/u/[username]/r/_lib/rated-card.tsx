import { ImageResponse } from "next/og";
import { C, loadFont, fontsOption } from "@/lib/og/brand";
import { posterDataUri } from "@/lib/og/poster";
import { resolveRatingShare, splitRich, type RatingShareView } from "./rating-share";
import es from "../../../../../../../messages/es.json";
import en from "../../../../../../../messages/en.json";

/**
 * Tarjeta "@benevi le da 9/10 a Dune" (CRE-8a), con next/og. Se pinta SIEMPRE
 * sin sesión (la piden crawlers de X, WhatsApp…): nunca usa cookies.
 *
 * Dos puertas, y ninguna es un archivo de metadatos con la firma:
 *   - `[id]/opengraph-image`: la genérica (título + perfil). Solo lleva nota
 *     con `SHARE_PUBLIC_LIBRARY=1` y biblioteca pública.
 *   - `[id]/card/[firma]` (route handler): la del enlace firmado del dueño,
 *     con nota salvo "Solo yo"; con una firma que no vale, 404.
 * La firma no está en `generateImageMetadata` (Next la publicaría como
 * og:image en cualquier respuesta de la página, también en un 404): solo la
 * escriben los metadatos de la página cuando la petición ya trae una firma
 * válida.
 *
 * Caché corta (no la de un año por defecto de `ImageResponse`): si el dueño
 * cambia la nota o cierra su biblioteca, la tarjeta deja de enseñarla pronto.
 * Igual que las demás tarjetas, nunca depende de que un proveedor responda.
 */
export const CARD_SIZE = { width: 1200, height: 630 };

export const OG_CACHE_CONTROL = "public, max-age=300, s-maxage=600";

const POSTER_W = 300;
const POSTER_H = 450;

export type CardParams = { locale: string; username: string; type: string; id: string };

export function decode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function messagesFor(locale: string) {
  return (locale === "en" ? en : es).share.og;
}

type Word = { text: string; tag?: string };

/** Palabra a palabra (satori parte líneas por elemento), conservando la etiqueta de cada trozo. */
function words(parts: Array<{ text: string; tag?: string }>): Word[][] {
  const out: Word[][] = [];
  let glued = false;
  for (const part of parts) {
    // La nota y el título no se parten por dentro de una pegatina.
    if (part.tag === "score") {
      out.push([{ text: part.text, tag: part.tag }]);
      glued = false;
      continue;
    }
    for (const piece of part.text.split(/(\s+)/).filter(Boolean)) {
      if (/^\s+$/.test(piece)) {
        glued = false;
        continue;
      }
      const w = { text: piece, tag: part.tag };
      if (glued && out.length) out[out.length - 1].push(w);
      else out.push([w]);
      glued = true;
    }
  }
  return out;
}

function headingParts(view: RatingShareView, locale: string) {
  const ui = (locale === "en" ? en : es).share.page;
  if (view.kind === "rated") {
    return splitRich(ui.heading, { username: view.owner.username, title: view.media.title, rating: view.rating.text });
  }
  if (view.kind === "generic") return splitRich(ui.genericHeading, { title: view.media.title });
  return [{ text: "KULTURA" }];
}

/** La tarjeta para `p` con la firma `sig` (sin ella, la genérica). */
export async function renderRatedCard(p: CardParams, sig?: string): Promise<ImageResponse> {
  const locale = p.locale === "en" ? "en" : "es";
  const og = messagesFor(locale);

  const view = await resolveRatingShare({
    username: decode(p.username),
    type: p.type,
    externalId: decode(p.id),
    locale,
    sig,
    viewer: null,
  }).catch((): RatingShareView => ({ kind: "not_found" }));

  const parts = headingParts(view, locale);
  const lines = words(parts);
  const poster = view.kind !== "not_found" && view.media.poster ? await posterDataUri(view.media.poster) : null;
  const handle = view.kind !== "not_found" ? `@${view.owner.username}` : "";
  const footer = view.kind === "rated" ? og.cta : handle;
  const glyphs = parts.map((x) => x.text).join("");
  const long = glyphs.length > 48;

  const fonts = (
    await Promise.all([
      loadFont("Bricolage+Grotesque", 800, `kultura${glyphs}`),
      loadFont("Figtree", 700, `${handle}${footer}`),
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
          padding: "0 80px",
          background: `radial-gradient(120% 100% at 20% 10%, rgba(230,59,125,0.30), ${C.bg} 55%)`,
          color: C.text,
          fontFamily: "Figtree",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 640 }}>
          <div style={{ display: "flex", alignItems: "flex-end", fontSize: 40, fontWeight: 800, fontFamily: "Bricolage Grotesque" }}>
            kultura
            <div style={{ width: 9, height: 9, background: C.lime, transform: "rotate(14deg)", marginLeft: 4, marginBottom: 9 }} />
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              marginTop: 48,
              fontSize: long ? 54 : 66,
              fontWeight: 800,
              letterSpacing: -2,
              lineHeight: 1.12,
              fontFamily: "Bricolage Grotesque",
            }}
          >
            {lines.map((word, i) => (
              <div key={i} style={{ display: "flex", marginRight: 16 }}>
                {word.map((w, j) =>
                  w.tag === "score" ? (
                    <div
                      key={j}
                      style={{
                        display: "flex",
                        padding: "4px 22px",
                        borderRadius: 999,
                        background: C.lime,
                        color: "#1c1622",
                        transform: "rotate(-3deg)",
                        boxShadow: "6px 6px 0 rgba(0,0,0,0.4)",
                      }}
                    >
                      {w.text}
                    </div>
                  ) : (
                    <div key={j} style={{ display: "flex", color: w.tag === "work" ? C.pink : C.text }}>
                      {w.text}
                    </div>
                  )
                )}
              </div>
            ))}
          </div>
          {footer ? (
            <div style={{ display: "flex", marginTop: 40, fontSize: 30, fontWeight: 700, color: C.muted }}>{footer}</div>
          ) : null}
        </div>
        <div
          style={{
            display: "flex",
            width: POSTER_W,
            height: POSTER_H,
            borderRadius: 24,
            overflow: "hidden",
            background: "linear-gradient(155deg, #e63b7d, #6e1f42)",
            transform: "rotate(3deg)",
            boxShadow: `12px 12px 0 ${C.surface2}`,
          }}
        >
          {poster && (
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
            <img src={poster} width={POSTER_W} height={POSTER_H} style={{ objectFit: "cover" }} />
          )}
        </div>
      </div>
    ),
    { ...CARD_SIZE, ...fontsOption(fonts), headers: { "cache-control": OG_CACHE_CONTROL } }
  );
}
