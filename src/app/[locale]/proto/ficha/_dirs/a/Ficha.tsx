// Dirección A «Sala» — la obra a pantalla completa (referencia: MUBI) con el
// título dentro de la imagen. Debajo, una franja con el color de la portada
// (título original, datos y acciones) y la ficha sobre el fondo teñido.
// Server Component: todo el texto sale en el HTML.

import "./a.css";
import { Actions } from "../../_base/content/Actions";
import { FactList, Genres, Ratings, SourceLine, SteamBlock, Synopsis, TrailerSlot, WhereToWatch } from "../../_base/content/Blocks";
import type { DirectionProps } from "../../_base/types";
import { Stage } from "./Stage";

export default function FichaA({ data }: DirectionProps) {
  const l = data.labels;
  const es = data.locale !== "en";
  return (
    <main id="main-content" className="a-ficha">
      <Stage
        title={data.title}
        cover={data.cover}
        fuseLabel={es ? "Letras fundidas" : "Fused lettering"}
      />

      <section className="a-band" aria-label={l.details}>
        <div className="a-band-id">
          {data.originalTitle && (
            <p className="a-original" lang={data.originalTitleLang}>
              <span className="kp-sr">{l.originalTitle}: </span>
              {data.originalTitle}
            </p>
          )}
          <FactList facts={data.facts} className="a-facts" />
        </div>
        <div className="a-band-act">
          <Actions labels={l} />
          <p className="a-mock">{l.mock}</p>
        </div>
      </section>

      <div className="a-body">
        <section className="a-synopsis">
          <h2>{l.synopsis}</h2>
          <Synopsis data={data} />
        </section>

        <aside className="a-side" aria-label={l.details}>
          <Ratings data={data} className="a-ratings" />
          <FactList facts={data.credits} className="a-credits" />
          {data.genres.length > 0 && (
            <div className="a-genres">
              <h2 className="a-small-h">{l.genres}</h2>
              <Genres data={data} />
            </div>
          )}
        </aside>

        <WhereToWatch data={data} heading={<h2>{l.whereToWatch}</h2>} />
        <SteamBlock data={data} heading={<h2>{l.steam}</h2>} />
        <TrailerSlot data={data} heading={<h2>{l.trailer}</h2>} />
      </div>

      <footer className="a-foot">
        <SourceLine data={data} />
      </footer>
    </main>
  );
}
