// ============================================================
// KULTURA — Tarjeta OG de una nota compartida (F-29), 1200×630
// GET /{locale}/u/{usuario}/r/{tipo}/{id}/card?s={firma}
// Con firma válida: "benevi le da 9/10 a Dune" con la portada. Sin ella (o
// sin nota): solo el título, sin nada de la persona. Es un Route Handler y
// no un `opengraph-image` porque necesita la firma de la query.
// Nunca falla por un proveedor: sin portada, degradado; sin fuentes, la de
// por defecto.
// ============================================================

import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { C, FORMAT_HEX, fontsOption, loadFont } from "@/lib/og/brand";
import { posterDataUri } from "@/lib/og/poster";
import { loadMediaDetail } from "@/lib/media/detail-data";
import { parseMediaId } from "@/lib/media/media-id";
import { formatRating10, loadSharedRating } from "../../../_lib/share";

const size = { width: 1200, height: 630 };
const POSTER_W = 330;
const POSTER_H = 495;
/** Una hora en el CDN: la nota puede cambiar, pero la tarjeta se pide mucho. */
const CACHE = "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";

interface Ctx {
  params: Promise<{ locale: string; username: string; type: string; id: string }>;
}

function decode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function GET(request: Request, { params }: Ctx): Promise<Response> {
  const { locale: rawLocale, username, type, id: rawId } = await params;
  const locale = rawLocale === "en" ? "en" : "es";
  const id = decode(rawId);
  const parsed = parseMediaId(`${type}_${id}`);
  if (!parsed) return new Response("Not found", { status: 404 });
  const sig = new URL(request.url).searchParams.get("s");

  const [shared, detail, t] = await Promise.all([
    loadSharedRating(decode(username), parsed.id, sig),
    loadMediaDetail(type, id, locale),
    getTranslations({ locale, namespace: "share" }),
  ]);
  const title = detail?.item.title ?? "KULTURA";
  const poster = detail?.item.poster ? await posterDataUri(detail.item.poster) : null;
  const rating = shared ? formatRating10(shared.rating10, locale) : null;
  const lead = shared ? t("cardLead", { username: shared.owner.username }) : t("cardGeneric");
  const accent = FORMAT_HEX[parsed.type] ?? C.pink;

  const fonts = (
    await Promise.all([
      loadFont("Bricolage+Grotesque", 800, `kultura${title}${rating ?? ""}/10`),
      loadFont("Figtree", 700, lead),
    ])
  ).filter((f) => f !== null);

  const image = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          padding: "0 80px",
          gap: 64,
          background: `radial-gradient(120% 100% at 85% 0%, rgba(145,227,0,0.22), ${C.bg} 55%)`,
          color: C.text,
          fontFamily: "Figtree",
        }}
      >
        <div
          style={{
            display: "flex",
            width: POSTER_W,
            height: POSTER_H,
            flexShrink: 0,
            borderRadius: 24,
            overflow: "hidden",
            background: `linear-gradient(155deg, ${accent}, #1f1a2e)`,
            transform: "rotate(-3deg)",
            boxShadow: `12px 12px 0 ${C.surface2}`,
          }}
        >
          {poster && (
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
            <img src={poster} width={POSTER_W} height={POSTER_H} style={{ objectFit: "cover" }} />
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-end", fontSize: 40, fontWeight: 800, fontFamily: "Bricolage Grotesque" }}>
            kultura
            <div style={{ width: 8, height: 8, background: C.pink, transform: "rotate(14deg)", marginLeft: 4, marginBottom: 9 }} />
          </div>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: C.muted, marginTop: 40 }}>{lead}</div>
          {rating && (
            <div style={{ display: "flex", alignItems: "flex-end", marginTop: 4, fontFamily: "Bricolage Grotesque", fontWeight: 800 }}>
              <div style={{ display: "flex", fontSize: 150, lineHeight: 1, color: C.lime, letterSpacing: -6 }}>{rating}</div>
              <div style={{ display: "flex", fontSize: 56, color: C.muted, marginBottom: 18, marginLeft: 6 }}>/10</div>
            </div>
          )}
          <div
            style={{
              display: "flex",
              fontSize: title.length > 28 ? 48 : 64,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -2,
              marginTop: rating ? 8 : 12,
              fontFamily: "Bricolage Grotesque",
            }}
          >
            {title.length > 60 ? `${title.slice(0, 57)}…` : title}
          </div>
        </div>
      </div>
    ),
    { ...size, ...fontsOption(fonts), headers: { "Cache-Control": CACHE } },
  );
  return image;
}
