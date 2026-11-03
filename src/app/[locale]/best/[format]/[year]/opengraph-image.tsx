import { ImageResponse } from "next/og";
import { createTranslator } from "next-intl";
import es from "../../../../../../messages/es.json";
import en from "../../../../../../messages/en.json";
import { C, FORMAT_HEX, OG_FONT, fontsOption, loadDisplayFont, loadFont, loadLogoFont } from "@/lib/og/brand";
import { OgCromo, OgWordmark } from "@/lib/og/cromo";
import { posterDataUri } from "@/lib/og/poster";
import { getBestOf, parseBestParams } from "@/lib/best/best-of";

/**
 * Tarjeta al compartir un ranking (/best/{formato}/{año}), 1200×630: una
 * página impresa del álbum. Campo cian con el titular en Lilita One (el mismo
 * texto que el h1 de la página, de `best.title`), el formato con su color
 * junto a su nombre y el logotipo; a la derecha, el podio: las tres portadas
 * reales como cromos con su caja amarilla del puesto, en escalera como en la
 * web. NUNCA depende de que el proveedor responda: sin datos, salen los
 * respaldos de color.
 */
export const alt = "KULTURA";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MESSAGES = { es, en } as const;

/** Podio: tamaño y bajada de cada cromo (como `md:mt-16` / `md:mt-32`). */
const PODIUM = [
  { w: 230, h: 345, top: 0 },
  { w: 190, h: 285, top: 50 },
  { w: 160, h: 240, top: 100 },
] as const;

type Params = { locale: string; format: string; year: string };

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export default async function Image({ params }: { params: Params | Promise<Params> }) {
  const { locale, format, year } = await params;
  const l = locale === "en" ? "en" : "es";
  const parsed = parseBestParams(format, year);
  const t = createTranslator({ locale: l, messages: MESSAGES[l] });
  const heading = parsed ? t(`best.title.${parsed.format}`, { year: parsed.year }) : "KULTURA";
  const formatLabel = parsed ? t(`album.format.${parsed.format}`) : "";

  const items = parsed ? await getBestOf(parsed.format, parsed.year, l).catch(() => []) : [];
  const posters = await Promise.all(items.slice(0, 3).map((i) => posterDataUri(i.poster)));
  while (posters.length < 3) posters.push(null);
  const top = items[0]?.title ? clip(items[0].title, 34) : "";
  const meta = top ? `1. ${top}` : "";

  const fonts = await Promise.all([
    loadDisplayFont(`${heading}123`),
    loadFont("Figtree", 700, `${formatLabel}${meta}`),
    loadLogoFont(),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "56px 64px",
          background: C.cyan,
          color: C.navy,
          fontFamily: OG_FONT.body,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", width: 440 }}>
          <OgWordmark size={44} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontFamily: OG_FONT.display, fontSize: 76, lineHeight: 1.02, color: C.navy }}>
              {heading}
            </div>
            {parsed ? (
              <div style={{ display: "flex", alignItems: "center", marginTop: 26, fontSize: 28, fontWeight: 700 }}>
                <div style={{ width: 18, height: 18, borderRadius: 9, background: FORMAT_HEX[parsed.format], border: `2px solid ${C.navy}`, marginRight: 12 }} />
                {formatLabel}
              </div>
            ) : null}
            {meta ? <div style={{ display: "flex", marginTop: 10, fontSize: 28, fontWeight: 700 }}>{meta}</div> : null}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", height: PODIUM[0].h }}>
          {posters.map((uri, i) => (
            <OgCromo
              key={i}
              uri={uri}
              width={PODIUM[i].w}
              height={PODIUM[i].h}
              n={i + 1}
              style={{ marginTop: PODIUM[i].top, marginLeft: i === 0 ? 0 : 16 }}
            />
          ))}
        </div>
      </div>
    ),
    { ...size, ...fontsOption(fonts) },
  );
}
