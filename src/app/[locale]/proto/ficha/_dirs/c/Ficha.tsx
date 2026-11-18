// Dirección C «Pliego» — una página serena sobre un suelo neutro (gris piedra
// en claro, grafito en oscuro): mucha letra, rejilla asimétrica de tres ejes y
// la portada en una ventana 4:5 donde la imagen deriva despacio. El color de
// la portada solo aparece en pequeño (acción principal, subrayados, la pastilla
// del formato y la tira de color bajo la ventana).
// Server Component: todo el texto sale en el HTML.

import type { CSSProperties } from "react";
import "./c.css";
import { Actions } from "../../_base/content/Actions";
import { FactList, Ratings, SourceLine, SteamBlock, Synopsis, WhereToWatch } from "../../_base/content/Blocks";
import type { DirectionProps } from "../../_base/types";
import { Ventana } from "./Ventana";

/**
 * «Ancho» del título en caracteres por línea, para que el rótulo llene su
 * columna en 1–3 líneas (el tamaño se calcula en CSS con unidades de contenedor).
 */
function titleMeasure(title: string): number {
  const t = title.trim();
  const wide = /[぀-ヿ㐀-鿿가-힯]/.test(t) ? 2 : 1; // CJK: un cuadratín por carácter
  const len = [...t].length;
  const longest = Math.max(...t.split(/\s+/).map((w) => [...w].length));
  const lines = len > 30 ? 3 : len > 12 ? 2 : 1;
  return Math.max(longest, Math.ceil(len / lines) + (lines > 1 ? 1 : 0), 4) * wide;
}

// `?serif=0` enseña el rótulo sin serif (Schibsted Grotesk). Se lee antes de pintar
// para que no parpadee; el servidor no lo sabe (la página es de la base).
const SERIF_SWITCH = `(function(){try{var m=document.currentScript.parentElement;if(/[?&]serif=0(&|$)/.test(location.search))m.setAttribute("data-serif","0")}catch(e){}})()`;

export default function FichaC({ data }: DirectionProps) {
  const l = data.labels;
  const es = data.locale !== "en";
  const details = [
    ...data.credits,
    ...(data.genres.length ? [{ key: "genres", label: l.genres, value: data.genres.join(", ") }] : []),
  ];
  return (
    <main
      id="main-content"
      className="c-ficha"
      style={{ "--c-n": titleMeasure(data.title) } as CSSProperties}
      suppressHydrationWarning
    >
      <script dangerouslySetInnerHTML={{ __html: SERIF_SWITCH }} />

      <div className="c-top">
        <header className="c-head">
          <h1 className="c-title" lang={data.titleLang}>{data.title}</h1>
          {data.originalTitle && (
            <p className="c-original" lang={data.originalTitleLang}>
              <span className="kp-sr" lang={data.locale}>
                {l.originalTitle}:{" "}
              </span>
              {data.originalTitle}
            </p>
          )}
        </header>

        <div className="c-data">
          <FactList facts={data.facts} className="c-facts" />
          <Ratings data={data} className="c-ratings" />
        </div>

        <div className="c-plate">
          {data.cover && (
            <Ventana cover={data.cover} title={data.title} trailerKey={data.trailerKey} locale={data.locale} />
          )}
          <div className="c-act">
            <Actions labels={l} />
            <p className="c-note">{l.mock}</p>
          </div>
        </div>

        <section className="c-synopsis">
          <h2>{l.synopsis}</h2>
          <Synopsis data={data} />
        </section>
      </div>

      <div className="c-rest">
        {details.length > 0 && (
          <section className="c-details">
            <h2>{l.details}</h2>
            <FactList facts={details} className="c-credits" />
          </section>
        )}
        <WhereToWatch data={data} heading={<h2>{l.whereToWatch}</h2>} />
        <SteamBlock data={data} heading={<h2>{l.steam}</h2>} />
      </div>

      <footer className="c-foot">
        <SourceLine data={data} />
        <p className="c-typeswitch">
          {es ? "Rótulo de esta propuesta:" : "Display type in this proposal:"}{" "}
          <a className="kp-link" href="?serif=1" data-serif-opt="1">
            {es ? "con serif (Fraunces)" : "serif (Fraunces)"}
          </a>{" "}
          <a className="kp-link" href="?serif=0" data-serif-opt="0">
            {es ? "sin serif (Schibsted Grotesk)" : "sans serif (Schibsted Grotesk)"}
          </a>
        </p>
      </footer>
    </main>
  );
}
