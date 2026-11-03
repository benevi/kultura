import { ImageResponse } from "next/og";
import { createTranslator } from "next-intl";
import { OG_FONT, fontsOption } from "@/lib/og/brand";
import { posterDataUri } from "@/lib/og/poster";
import { getPublicCollection, resolveRenamedUsername } from "@/lib/social/public-collection";
import { publicTopFour } from "./r/_lib/top-four";
import { PROFILE_OG_ID } from "@/components/pwa/share";
import { CromoGrid, INK, Wordmark, albumFonts } from "./_og/album-card";
import es from "../../../../../messages/es.json";
import en from "../../../../../messages/en.json";

/**
 * Tarjeta al compartir /u/{username}: la portada de su álbum en el campo
 * cian («El álbum de @ana», su número de listas) y una página de cuatro
 * cromos de sus listas públicas. Cada portada se descarga aquí con un tope
 * de tiempo y, si falla, queda su hueco discontinuo: la tarjeta NUNCA
 * depende de que un proveedor responda.
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
  const handle = `@${displayName}`;
  const fonts = await albumFonts(`${handle}1234`, `${heading}${meta}`);

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
          background: INK.cyan,
          color: INK.navy,
          fontFamily: "Figtree",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 560 }}>
          <Wordmark size={44} />
          <div style={{ display: "flex", fontSize: 36, fontWeight: 700, marginTop: 64 }}>{heading}</div>
          <div
            style={{
              display: "flex",
              fontFamily: OG_FONT.display,
              fontSize: handle.length > 14 ? 68 : 92,
              lineHeight: 1,
              marginTop: 10,
              wordBreak: "break-all",
            }}
          >
            {handle}
          </div>
          {lists.length > 0 ? (
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                marginTop: 36,
                padding: "8px 18px",
                borderRadius: 6,
                background: INK.white,
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              {meta}
            </div>
          ) : null}
        </div>
        <CromoGrid posters={posters} numbered={Boolean(top)} />
      </div>
    ),
    { ...size, ...fontsOption(fonts), headers: { "cache-control": OG_CACHE_CONTROL } },
  );
}
