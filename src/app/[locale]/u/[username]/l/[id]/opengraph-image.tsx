import { ImageResponse } from "next/og";
import { createTranslator } from "next-intl";
import { C, loadFont, fontsOption } from "@/lib/og/brand";
import { posterDataUri } from "@/lib/og/poster";
import { getPublicList } from "@/lib/social/public-collection";
import es from "../../../../../../../messages/es.json";
import en from "../../../../../../../messages/en.json";

/**
 * Tarjeta al compartir una lista pública, /u/{username}/l/{id} (fase 8.2,
 * «Invitar»): nombre de la lista, de quién es, cuántos títulos y hasta cuatro
 * de sus portadas. Antes la lista salía con la tarjeta genérica del sitio.
 * Mismo trato que la del perfil: cada portada se descarga con tope de tiempo
 * y, si falla, su hueco queda con un gradiente; la tarjeta se pide sin sesión
 * y solo lee listas PÚBLICAS (una privada o inexistente da la tarjeta vacía).
 * Sin `generateImageMetadata`: la ruta es `/opengraph-image`, la que espera
 * `ogImagePath` al compartir con imagen desde el móvil.
 */
export const alt = "KULTURA";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type CardParams = { locale: string; username: string; id: string };
const MESSAGES = { es, en } as const;

function decode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

const POSTER_W = 220;
const POSTER_H = 330;
const FALLBACKS = [
  "linear-gradient(155deg, #e63b7d, #6e1f42)",
  "linear-gradient(155deg, #b83cc8, #4f1a5a)",
  "linear-gradient(155deg, #4a7dd8, #1f3766)",
  "linear-gradient(155deg, #e8933c, #6b3f15)",
];
const TILT = [-6, 3, -2, 5];
/** Nombres largos: se cortan para que quepan en dos líneas. */
const NAME_MAX = 44;

/** Caché corta: si cambia la lista, la tarjeta no se queda un año. */
const OG_CACHE_CONTROL = "public, max-age=300, s-maxage=600";

export default async function Image({ params }: { params: CardParams | Promise<CardParams> }) {
  const { locale, username: rawUsername, id } = await params;
  const username = decode(rawUsername);
  const l = locale === "en" ? "en" : "es";
  const t = createTranslator({ locale: l, messages: MESSAGES[l], namespace: "collection" });

  const data = await getPublicList(username, decode(id)).catch(() => null);
  const owner = data?.owner.username ?? username;
  const items = data?.list.items ?? [];
  const rawName = data?.list.name ?? t("metaTitle", { username: owner });
  const name = rawName.length > NAME_MAX ? `${rawName.slice(0, NAME_MAX - 1).trimEnd()}…` : rawName;

  const sources = items
    .map((i) => i.poster)
    .filter((p): p is string => Boolean(p))
    .slice(0, 4);
  const posters = await Promise.all(sources.map(posterDataUri));
  while (posters.length < 4) posters.push(null);

  const byline = t("listMetaDescription", { username: owner });
  const meta = t("items", { count: items.length });
  const fonts = (
    await Promise.all([
      loadFont("Bricolage+Grotesque", 800, `kultura${name}`),
      loadFont("Figtree", 700, `${byline}${meta}`),
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
          background: `radial-gradient(120% 100% at 20% 10%, ${C.purpleGlow}, ${C.bg} 55%)`,
          color: C.text,
          fontFamily: "Figtree",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 520 }}>
          <div style={{ display: "flex", alignItems: "flex-end", fontSize: 44, fontWeight: 800, fontFamily: "Bricolage Grotesque" }}>
            kultura
            <div style={{ width: 9, height: 9, background: C.pink, transform: "rotate(14deg)", marginLeft: 4, marginBottom: 10 }} />
          </div>
          <div
            style={{
              display: "flex",
              fontSize: name.length > 22 ? 56 : 80,
              fontWeight: 800,
              letterSpacing: -2,
              lineHeight: 1.05,
              marginTop: 48,
              fontFamily: "Bricolage Grotesque",
            }}
          >
            {name}
          </div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: C.muted, marginTop: 16 }}>
            {byline}
          </div>
          {items.length > 0 && (
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                marginTop: 28,
                padding: "10px 22px",
                borderRadius: 999,
                background: C.lime,
                color: "#1c1622",
                fontSize: 26,
                fontWeight: 700,
              }}
            >
              {meta}
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
                marginLeft: i === 0 ? 0 : -90,
                marginTop: i % 2 === 0 ? 0 : 60,
                borderRadius: 16,
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
    { ...size, ...fontsOption(fonts), headers: { "cache-control": OG_CACHE_CONTROL } },
  );
}
