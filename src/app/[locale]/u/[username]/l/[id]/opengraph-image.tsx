import { ImageResponse } from "next/og";
import { createTranslator } from "next-intl";
import { OG_FONT, fontsOption } from "@/lib/og/brand";
import { posterDataUri } from "@/lib/og/poster";
import { getPublicList } from "@/lib/social/public-collection";
import { getPublicListExtras, sortListItems } from "@/lib/social/lists";
import { CromoGrid, INK, Wordmark, albumFonts } from "../../_og/album-card";
import es from "../../../../../../../messages/es.json";
import en from "../../../../../../../messages/en.json";

/**
 * Tarjeta al compartir una lista pública (/u/{usuario}/l/{id}): la cabecera
 * de la lista en el campo amarillo (su nombre en Lilita, de quién es y
 * cuántos títulos tiene) y sus cuatro primeros cromos en el orden del dueño
 * (numerados si es un «Ranking personal»). Solo listas públicas: la misma
 * lectura que la página, sin sesión. Si la lista no existe o no es pública,
 * la tarjeta es solo la marca (nunca enseña una lista privada).
 *
 * Cada portada se descarga con un tope de tiempo; si falla, queda su hueco
 * discontinuo. El `alt` va traducido y con el nombre de la lista
 * (`generateImageMetadata`, sin next-intl/server en esta capa).
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Caché corta: si la lista deja de ser pública, la tarjeta no se queda un año. */
const OG_CACHE_CONTROL = "public, max-age=300, s-maxage=600";

type CardParams = { locale: string; username: string; id: string };
const MESSAGES = { es, en } as const;
const cardLocale = (locale: string) => (locale === "en" ? "en" : "es");

function decodeName(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

async function load(p: CardParams) {
  const username = decodeName(p.username);
  const [data, extras] = await Promise.all([
    getPublicList(username, p.id).catch(() => null),
    getPublicListExtras(p.id).catch(() => null),
  ]);
  return { username, data, extras };
}

export async function generateImageMetadata({ params }: { params: CardParams | Promise<CardParams> }) {
  const p = await params;
  const l = cardLocale(p.locale);
  const t = createTranslator({ locale: l, messages: MESSAGES[l], namespace: "collection" });
  const { username, data } = await load(p);
  const alt = data
    ? t("listOgAlt", { list: data.list.name, username: data.owner.username })
    : t("metaTitle", { username });
  return [{ id: "card", alt, size, contentType }];
}

export default async function Image({ params }: { params: CardParams | Promise<CardParams> }) {
  const p = await params;
  const l = cardLocale(p.locale);
  const t = createTranslator({ locale: l, messages: MESSAGES[l], namespace: "collection" });
  const { data, extras } = await load(p);

  const items = data?.list.items ?? [];
  // Orden del dueño si se conoce (F-25); si no, el de llegada.
  const ordered = extras
    ? sortListItems(
        items.map((item) => ({ entry: item, position: extras.items.get(item.mediaId)?.position ?? null })),
      ).map(({ entry }) => entry)
    : items;
  const first = ordered.slice(0, 4);
  const posters = await Promise.all(first.map((i) => (i.poster ? posterDataUri(i.poster) : Promise.resolve(null))));

  const name = data?.list.name ?? "";
  const byline = data ? t("listOgByline", { username: data.owner.username }) : "";
  const count = data ? t("items", { count: items.length }) : "";
  const fonts = await albumFonts(`${name}1234`, `${byline}${count}`);

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
          background: INK.yellow,
          color: INK.navy,
          fontFamily: "Figtree",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 580 }}>
          <Wordmark size={44} />
          {data ? (
            <>
              <div
                style={{
                  display: "flex",
                  fontFamily: OG_FONT.display,
                  fontSize: name.length > 40 ? 56 : name.length > 22 ? 68 : 84,
                  lineHeight: 1.05,
                  marginTop: 56,
                }}
              >
                {name}
              </div>
              <div style={{ display: "flex", fontSize: 32, fontWeight: 700, marginTop: 28 }}>{byline}</div>
              <div
                style={{
                  display: "flex",
                  alignSelf: "flex-start",
                  marginTop: 24,
                  padding: "8px 18px",
                  borderRadius: 6,
                  background: INK.white,
                  fontSize: 28,
                  fontWeight: 700,
                }}
              >
                {count}
              </div>
            </>
          ) : null}
        </div>
        {data ? <CromoGrid posters={posters} numbered={extras?.template === "ranking"} /> : null}
      </div>
    ),
    { ...size, ...fontsOption(fonts), headers: { "cache-control": OG_CACHE_CONTROL } },
  );
}
