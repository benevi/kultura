// Dirección A «Sala» — la obra a pantalla completa (referencia: MUBI) con el
// título dentro de la imagen: arte apaisado SIN rótulo, a sangre. Si la obra no
// lo tiene (libro, manga, cómic), la portada entera como pieza sobre un campo
// de su color y el título debajo, sin fundir. Debajo, una franja con el color de la portada
// (título original, datos y acciones) y la ficha sobre el fondo teñido; el
// tráiler, en su sección, al final.
// Server Component: todo el texto sale en el HTML.

import "./a.css";
import { Actions } from "../../_base/content/Actions";
import { FactList, Genres, Ratings, SourceLine, SteamBlock, Synopsis, WhereToWatch } from "../../_base/content/Blocks";
import type { DirectionProps } from "../../_base/types";
import { Stage } from "./Stage";
import { Trailer } from "./Trailer";

export default function FichaA({ data }: DirectionProps) {
  const l = data.labels;
  const es = data.locale !== "en";
  return (
    <main id="main-content" className="a-ficha">
      <Stage
        title={data.title}
        titleLang={data.titleLang}
        cover={data.art ?? data.cover}
        mode={data.art ? "wide" : "piece"}
        fuseLabel={es ? "Letras fundidas" : "Fused lettering"}
        depthKey={`${data.type}/${data.item.externalId}`}
        spineRight={data.type === "manga"}
        es={es}
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

        {data.trailerKey && (
          <section className="a-trailer">
            <h2>{l.trailer}</h2>
            <Trailer
              trailerKey={data.trailerKey}
              // Nunca la imagen de la sala: otra oficial sin rótulo o, si no hay, el marco sin imagen.
              image={data.trailerArt?.src}
              imageSet={data.trailerArt?.srcSet}
              imageCross={data.trailerArt?.canvasSafe ? "anonymous" : undefined}
              playText={es ? "Ver el tráiler" : "Watch the trailer"}
              playLabel={es ? `Ver el tráiler de ${data.title}` : `Watch the trailer for ${data.title}`}
              closeLabel={es ? "Cerrar el tráiler" : "Close the trailer"}
              frameTitle={es ? `Tráiler de ${data.title}` : `Trailer for ${data.title}`}
            />
          </section>
        )}
      </div>

      <footer className="a-foot">
        <SourceLine data={data} />
      </footer>
    </main>
  );
}
