// Dirección C «Pliego» — PENDIENTE. Este archivo es un marcador: pinta la
// ficha sin estilo con los bloques compartidos para que la ruta funcione.
// Quien construya C lo sustituye entero (contrato en docs/proto/fase8-3/DIRECCIONES.md).

import "./c.css";
import { Actions } from "../../_base/content/Actions";
import { FactList, Genres, Ratings, SourceLine, SteamBlock, Synopsis, TrailerSlot, WhereToWatch } from "../../_base/content/Blocks";
import type { DirectionProps } from "../../_base/types";

export default function FichaC({ data }: DirectionProps) {
  const l = data.labels;
  return (
    <main className="c-stub">
      <p>Dirección C «Pliego»: pendiente de construir.</p>
      {data.cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          data-kp-cover=""
          src={data.cover.src}
          srcSet={data.cover.srcSet}
          sizes="240px"
          alt=""
          width={240}
          crossOrigin={data.cover.canvasSafe ? "anonymous" : undefined}
        />
      )}
      <h1>{data.title}</h1>
      {data.originalTitle && <p lang={data.originalTitleLang}>{data.originalTitle}</p>}
      <FactList facts={data.facts} />
      <Genres data={data} />
      <Ratings data={data} />
      <Actions labels={l} />
      <h2>{l.synopsis}</h2>
      <Synopsis data={data} />
      <h2>{l.details}</h2>
      <FactList facts={data.credits} />
      <WhereToWatch data={data} heading={<h2>{l.whereToWatch}</h2>} />
      <SteamBlock data={data} heading={<h2>{l.steam}</h2>} />
      <TrailerSlot data={data} heading={<h2>{l.trailer}</h2>} />
      <SourceLine data={data} />
    </main>
  );
}
