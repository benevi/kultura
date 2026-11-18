// Dirección B «Objeto» — la portada es una cosa que se puede coger: libro con
// lomo, tomo de manga (lomo a la derecha), caja de juego, cartel. Está sola
// sobre una vitrina del color que da la portada (referencia: Apple Music / TV)
// y toda la página se tiñe de ese color. Redonda y centrada.
// Server Component: todo el texto sale en el HTML; el objeto (ObjectStage) es
// cliente solo para inclinarse y para montar el tráiler al pulsar.

import "./b.css";
import { Actions } from "../../_base/content/Actions";
import { FactList, Genres, Ratings, SourceLine, SteamBlock, Synopsis, WhereToWatch } from "../../_base/content/Blocks";
import type { DirectionProps } from "../../_base/types";
import { ObjectStage, type ObjectKind } from "./ObjectStage";

const KIND: Record<string, ObjectKind> = {
  movie: "poster",
  tv: "poster",
  anime: "poster",
  book: "book",
  manga: "manga",
  comic: "comic",
  game: "game",
};

export default function FichaB({ data }: DirectionProps) {
  const l = data.labels;
  const es = data.locale !== "en";
  return (
    <main id="main-content" className="b-ficha">
      <ObjectStage
        kind={KIND[data.type] ?? "poster"}
        cover={data.cover}
        typeLabel={data.typeLabel}
        trailerKey={data.trailerKey ?? null}
        playLabel={es ? `Ver el tráiler de ${data.title}` : `Watch the trailer for ${data.title}`}
        closeLabel={es ? "Cerrar el tráiler" : "Close the trailer"}
        trailerTitle={es ? `Tráiler de ${data.title}` : `Trailer for ${data.title}`}
      />

      <div className="b-col">
        <header className="b-head">
          <h1 className="b-title">{data.title}</h1>
          {data.originalTitle && (
            <p className="b-original" lang={data.originalTitleLang}>
              <span className="kp-sr">{l.originalTitle}: </span>
              {data.originalTitle}
            </p>
          )}
          <Actions labels={l} className="b-actions" />
          <p className="b-mock">{l.mock}</p>
        </header>

        <div className="b-body">
          <FactList facts={data.facts} className="b-facts" />

          <section className="b-synopsis">
            <h2>{l.synopsis}</h2>
            <Synopsis data={data} />
          </section>

          {(data.ratings.length > 0 || data.genres.length > 0) && (
            <section className="b-marks" aria-label={`${l.ratings} · ${l.genres}`}>
              <Ratings data={data} className="b-ratings" />
              <Genres data={data} className="b-genres" />
            </section>
          )}

          {data.credits.length > 0 && (
            <section className="b-panel" aria-label={l.details}>
              <FactList facts={data.credits} className="b-credits" />
            </section>
          )}

          <WhereToWatch data={data} heading={<h2>{l.whereToWatch}</h2>} />
          <SteamBlock data={data} heading={<h2>{l.steam}</h2>} />

          <footer className="b-foot">
            <SourceLine data={data} />
          </footer>
        </div>
      </div>
    </main>
  );
}
