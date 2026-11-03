import { ImageResponse } from "next/og";
import { C, OG_FONT, fontsOption, loadDisplayFont, loadFont, loadLogoFont } from "@/lib/og/brand";
import { OgCromo, OgWordmark } from "@/lib/og/cromo";
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

  const fonts = await Promise.all([
    loadDisplayFont(glyphs),
    loadFont("Figtree", 700, `${handle}${footer}`),
    loadLogoFont(),
  ]);

  // Página impresa del álbum: campo cian, tinta marina, la nota en la caja
  // amarilla y la portada como cromo (respaldo de color siempre detrás).
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
          background: C.cyan,
          color: C.navy,
          fontFamily: OG_FONT.body,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 640 }}>
          <OgWordmark size={40} />
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              marginTop: 48,
              fontSize: long ? 54 : 66,
              lineHeight: 1.12,
              fontFamily: OG_FONT.display,
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
                        padding: "2px 16px",
                        borderRadius: 6,
                        border: `3px solid ${C.navy}`,
                        background: C.yellow,
                        color: C.ink,
                      }}
                    >
                      {w.text}
                    </div>
                  ) : (
                    <div key={j} style={{ display: "flex" }}>
                      {w.text}
                    </div>
                  )
                )}
              </div>
            ))}
          </div>
          {footer ? (
            <div style={{ display: "flex", marginTop: 40, fontSize: 30, fontWeight: 700 }}>{footer}</div>
          ) : null}
        </div>
        <OgCromo uri={poster} width={POSTER_W} height={POSTER_H} />
      </div>
    ),
    { ...CARD_SIZE, ...fontsOption(fonts), headers: { "cache-control": OG_CACHE_CONTROL } }
  );
}
