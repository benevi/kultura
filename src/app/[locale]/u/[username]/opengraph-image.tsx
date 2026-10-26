import { ImageResponse } from "next/og";
import { createTranslator } from "next-intl";
import { C, loadFont, fontsOption } from "@/lib/og/brand";
import { posterDataUri } from "@/lib/og/poster";
import { getPublicCollection, resolveRenamedUsername } from "@/lib/social/public-collection";
import { publicTopFour } from "./r/_lib/top-four";
import { PROFILE_OG_ID } from "@/components/pwa/share";
import es from "../../../../../messages/es.json";
import en from "../../../../../messages/en.json";

/**
 * Tarjeta al compartir /u/{username}: nombre + collage de hasta cuatro
 * portadas de sus listas públicas. Cada portada se descarga aquí con un tope
 * de tiempo y, si falla, su hueco queda con el gradiente de póster de F0: la
 * tarjeta NUNCA depende de que un proveedor responda.
 *
 * CRE-8c (F-29): con el top 4 visible SIN CUENTA (`publicTopFour`: bandera
 * `SHARE_PUBLIC_LIBRARY=1` y biblioteca pública), la tarjeta es "El top 4
 * de …" con sus 4 favoritos. La tarjeta se pide siempre sin sesión, así que
 * nunca enseña nada de una biblioteca que un anónimo no pueda ver. Caché corta
 * (5-10 min): si cambia la visibilidad, la tarjeta no se queda un año.
 *
 * El `alt` sale traducido y con el nombre («@ana en KULTURA») por
 * `generateImageMetadata`: la imagen vive en `/opengraph-image/card`
 * (`PROFILE_OG_ID`, la que pide `ogImagePath` para un perfil). Como en la
 * tarjeta del sitio, el texto se lee de los mensajes con `createTranslator`
 * (en esa capa `next-intl/server` no está disponible) y los plurales van en
 * ICU (`collection.listsCount`).
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type CardParams = { locale: string; username: string };
const MESSAGES = { es, en } as const;

const cardLocale = (locale: string) => (locale === "en" ? "en" : "es");

function decodeName(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    // `%` suelto: se usa tal cual (dará la tarjeta genérica).
    return raw;
  }
}

export async function generateImageMetadata({ params }: { params: CardParams | Promise<CardParams> }) {
  const { locale, username } = await params;
  const l = cardLocale(locale);
  const tOg = createTranslator({ locale: l, messages: MESSAGES[l], namespace: "share.og" });
  const alt = tOg("profileAlt", { username: decodeName(username) });
  return [{ id: PROFILE_OG_ID, alt, size, contentType }];
}

const POSTER_W = 220;
const POSTER_H = 330;
/** Gradientes de respaldo: mismo matiz en las dos paradas, la segunda más oscura. */
const FALLBACKS = [
  "linear-gradient(155deg, #e63b7d, #6e1f42)",
  "linear-gradient(155deg, #b83cc8, #4f1a5a)",
  "linear-gradient(155deg, #4a7dd8, #1f3766)",
  "linear-gradient(155deg, #e8933c, #6b3f15)",
];
const TILT = [-6, 3, -2, 5];

/** Ver la cabecera: la tarjeta puede depender de la visibilidad de la biblioteca. */
const OG_CACHE_CONTROL = "public, max-age=300, s-maxage=600";

export default async function Image({ params }: { params: CardParams | Promise<CardParams> }) {
  const { locale, username: rawUsername } = await params;
  const username = decodeName(rawUsername);
  const l = cardLocale(locale);
  const tOg = createTranslator({ locale: l, messages: MESSAGES[l], namespace: "share.og" });
  const t = createTranslator({ locale: l, messages: MESSAGES[l], namespace: "collection" });

  // R11: con un nombre antiguo, la tarjeta es la del nombre actual (la página
  // ya redirige con 308; la imagen se pide a veces por la URL vieja). Solo
  // listas públicas: la tarjeta la ve cualquiera, la biblioteca nunca (salvo
  // el top 4 cuando su dueño la deja ver sin cuenta, ver cabecera).
  let collection = await getPublicCollection(username).catch(() => null);
  if (!collection) {
    const current = await resolveRenamedUsername(username).catch(() => null);
    if (current) collection = await getPublicCollection(current).catch(() => null);
  }
  const displayName = collection?.owner.username ?? username;
  const top = collection ? await publicTopFour(displayName).catch(() => null) : null;
  const lists = collection?.lists ?? [];
  const sources = (top ?? lists.flatMap((list) => list.items))
    .map((i) => i.poster)
    .filter((p): p is string => Boolean(p))
    .slice(0, 4);
  const posters = await Promise.all(sources.map(posterDataUri));
  while (posters.length < 4) posters.push(null);

  const heading = top ? tOg("top4") : t("ogHeading");
  const meta = t("listsCount", { count: lists.length });
  const fonts = (
    await Promise.all([
      loadFont("Bricolage+Grotesque", 800, `kultura${displayName}`),
      loadFont("Figtree", 700, `${heading}${meta}`),
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
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 520 }}>
          <div style={{ display: "flex", alignItems: "flex-end", fontSize: 44, fontWeight: 800, fontFamily: "Bricolage Grotesque" }}>
            kultura
            <div style={{ width: 9, height: 9, background: C.pink, transform: "rotate(14deg)", marginLeft: 4, marginBottom: 10 }} />
          </div>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: C.muted, marginTop: 56 }}>
            {heading}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: displayName.length > 12 ? 72 : 96,
              fontWeight: 800,
              letterSpacing: -3,
              lineHeight: 1,
              marginTop: 8,
              fontFamily: "Bricolage Grotesque",
            }}
          >
            {displayName}
          </div>
          {lists.length > 0 && (
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                marginTop: 32,
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
